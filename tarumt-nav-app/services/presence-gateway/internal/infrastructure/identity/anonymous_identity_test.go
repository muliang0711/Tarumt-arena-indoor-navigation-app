package identity

import "testing"

func TestAnonymousIdentityIsStableAndDoesNotExposeInstallationID(t *testing.T) {
	t.Parallel()
	service := NewAnonymousIdentity("01234567890123456789012345678901")
	installationID := "8f912e7e-918b-4455-9561-f4494c44ff75"
	first, err := service.DeriveDeviceReference(installationID)
	if err != nil {
		t.Fatal(err)
	}
	second, err := service.DeriveDeviceReference(installationID)
	if err != nil {
		t.Fatal(err)
	}
	if first != second {
		t.Fatal("same installation ID should derive the same reference")
	}
	if first == installationID {
		t.Fatal("derived reference must not expose the raw installation ID")
	}
	if _, err := service.DeriveDeviceReference("too-short"); err == nil {
		t.Fatal("short installation ID should fail validation")
	}
}
