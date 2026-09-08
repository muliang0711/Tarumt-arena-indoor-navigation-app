"""Non-mutating deployment entrypoint tests; no DNS or Docker is contacted."""
import pathlib
import subprocess
import unittest

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "deploy-frontend.sh"


class FrontendScriptTests(unittest.TestCase):
    def run_script(self, *args):
        return subprocess.run(["bash", str(SCRIPT), *args], text=True, capture_output=True)

    def test_shell_syntax(self):
        self.assertEqual(subprocess.run(["bash", "-n", str(SCRIPT)]).returncode, 0)

    def test_help_without_dependencies_or_credentials(self):
        result = self.run_script("--help")
        self.assertEqual(result.returncode, 0)
        self.assertIn("--plan", result.stdout)

    def test_plan_needs_no_token_or_root_and_uses_private_http(self):
        result = self.run_script("--domain", "campus-test.duckdns.org", "--ip", "34.1.2.3", "--plan")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("private HTTP", result.stdout)
        self.assertIn("https://campus-test.duckdns.org", result.stdout)
        self.assertNotIn("DuckDNS accepted", result.stdout)
        self.assertIn("wss://campus-test.duckdns.org/v1/presence", result.stdout)
        self.assertIn("One Caddy owns 80/443", result.stdout)
        self.assertIn("synthetic session", result.stdout)

    def test_combined_proxy_retains_paths_and_private_boundaries(self):
        deploy = SCRIPT.parents[1]
        config = (deploy / "frontend.Caddyfile").read_text()
        self.assertIn("route {", config)
        for target in ["admin-web:3000", "presence-gateway:8080", "analytics-api:9092"]:
            self.assertIn("reverse_proxy " + target, config)
        self.assertNotIn("handle_path ", config)
        self.assertIn('respond "Not found" 404', config)
        compose = (deploy / "compose.frontend.yaml").read_text()
        self.assertIn("networks: [backend, web, edge]", compose)
        self.assertIn('ports: ["80:80", "443:443"]', compose)
        self.assertIn('profiles: [verification]', compose)
        self.assertIn('networks: [edge]', compose)

    def test_verification_is_required_before_success(self):
        script = SCRIPT.read_text()
        self.assertLess(script.index('run --rm --no-deps -T ingress-check'), script.index("Website + APK ingress verified:"))
        self.assertIn('Existing Caddy/nginx must be integrated manually; nothing was stopped.', script)

    def test_invalid_inputs_rejected_before_mutation(self):
        for domain, ip in [("bad.example.com", "34.1.2.3"),
                           ("x.duckdns.org;id", "34.1.2.3"),
                           ("-x.duckdns.org", "34.1.2.3"),
                           ("x.duckdns.org", "127.0.0.1"),
                           ("x.duckdns.org", "10.0.0.1"),
                           ("x.duckdns.org", "192.168.1.2"),
                           ("x.duckdns.org", "172.16.1.2"),
                           ("x.duckdns.org", "34.256.0.1"),
                           ("x.duckdns.org", "34.01.0.1")]:
            with self.subTest(domain=domain, ip=ip):
                self.assertNotEqual(self.run_script("--domain", domain, "--ip", ip, "--plan").returncode, 0)

    def test_bad_network_and_missing_values(self):
        self.assertNotEqual(self.run_script("--domain").returncode, 0)
        self.assertNotEqual(self.run_script("--unknown").returncode, 0)
        self.assertNotEqual(self.run_script("--domain", "x.duckdns.org", "--ip", "34.1.2.3", "--backend-network", "net\nEVIL=1", "--plan").returncode, 0)


if __name__ == "__main__":
    unittest.main()
