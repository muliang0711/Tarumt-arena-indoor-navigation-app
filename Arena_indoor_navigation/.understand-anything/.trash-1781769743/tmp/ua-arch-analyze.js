const fs = require("fs");
const path = require("path");

function normalized(filePath) {
  return String(filePath || "").replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function commonDirectoryPrefix(paths) {
  if (!paths.length) return [];
  const dirs = paths.map((p) => normalized(p).split("/").slice(0, -1));
  const prefix = [];
  for (let i = 0; i < Math.min(...dirs.map((parts) => parts.length)); i += 1) {
    const segment = dirs[0][i];
    if (!dirs.every((parts) => parts[i] === segment)) break;
    prefix.push(segment);
  }
  return prefix;
}

function flatFileGroup(filePath) {
  const name = path.posix.basename(normalized(filePath)).toLowerCase();
  if (/(\.test\.|\.spec\.|^test_|_test\.|test\.java$|tests\.cs$|_spec\.rb$)/.test(name)) return "test";
  if (/(\.config\.|^tsconfig|^package\.json$|^app\.json$)/.test(name)) return "config";
  const extension = path.posix.extname(name).slice(1);
  return extension || "root";
}

function directoryPattern(group) {
  const value = group.toLowerCase();
  const patterns = [
    [/^(routes?|api|controllers?|endpoints?|handlers?|serializers?|routers?|blueprints?)$/, "api"],
    [/^(services?|core|lib|domain|logic|internal|composables|mailers|jobs|channels|signals)$/, "service"],
    [/^(models?|db|data|persistence|repository|entities|entity|migrations|sql|database|schema)$/, "data"],
    [/^(components?|views?|pages?|ui|layouts?|screens?)$/, "ui"],
    [/^(middleware|plugins?|interceptors?|guards?)$/, "middleware"],
    [/^(utils?|helpers?|common|shared|tools|pkg|templatetags)$/, "utility"],
    [/^(config|constants|env|settings|management|commands)$/, "config"],
    [/^(__tests__|tests?|specs?|src\/test\/java)$/, "test"],
    [/^(types?|interfaces?|schemas|contracts?|dtos?|dto|request|response)$/, "types"],
    [/^hooks$/, "hooks"],
    [/^(store|state|reducers|actions|slices)$/, "state"],
    [/^(assets?|static|public)$/, "assets"],
    [/^(cmd|bin)$/, "entry"],
    [/^(docs|documentation|wiki)$/, "documentation"],
    [/^(deploy|deployment|infra|infrastructure|k8s|kubernetes|helm|charts|terraform|tf|docker)$/, "infrastructure"],
    [/^(\.github|\.gitlab|\.circleci)$/, "ci-cd"],
  ];
  return patterns.find(([regex]) => regex.test(value))?.[1] || null;
}

function filePattern(filePath) {
  const p = normalized(filePath);
  const name = path.posix.basename(p);
  const lower = name.toLowerCase();
  if (/(\.test\.|\.spec\.|^test_.*\.py$|_test\.go$|test\.java$|_spec\.rb$|test\.php$|tests\.cs$)/i.test(name)) return "test";
  if (/\.d\.ts$/i.test(name)) return "types";
  if (/^(index\.(ts|js)|__init__\.py)$/i.test(name)) return "entry";
  if (/^(manage\.py|config\.ru)$/i.test(name)) return "entry";
  if (/^(wsgi|asgi)\.py$/i.test(name)) return "config";
  if (/^(application\.java|program\.cs|main\.rs|lib\.rs)$/i.test(name)) return "entry";
  if (/^(cargo\.toml|go\.mod|gemfile|pom\.xml|build\.gradle|composer\.json|package\.json|tsconfig\.json)$/i.test(name)) return "config";
  if (/^dockerfile/i.test(name) || /^docker-compose\./i.test(name) || /\.(tf|tfvars)$/i.test(name) || lower === "makefile") return "infrastructure";
  if (/^\.github\/workflows\//i.test(p) || /^\.gitlab-ci\.yml$/i.test(name) || /^jenkinsfile$/i.test(name)) return "ci-cd";
  if (/\.sql$/i.test(name)) return "data";
  if (/\.(graphql|gql|proto)$/i.test(name)) return "types";
  if (/\.(md|rst)$/i.test(name)) return "documentation";
  return null;
}

function increment(map, key, amount = 1) {
  map[key] = (map[key] || 0) + amount;
}

try {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) {
    throw new Error("Usage: node ua-arch-analyze.js <input.json> <results.json>");
  }
  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const { fileNodes, importEdges, allEdges } = input;
  const byId = new Map(fileNodes.map((node) => [node.id, node]));
  const paths = fileNodes.map((node) => normalized(node.filePath));
  const prefix = commonDirectoryPrefix(paths);
  const hasNestedAfterPrefix = paths.some((p) => p.split("/").slice(prefix.length).length > 1);

  const directoryGroups = {};
  const groupById = {};
  for (const node of fileNodes) {
    const parts = normalized(node.filePath).split("/");
    let group;
    if (!hasNestedAfterPrefix) {
      group = flatFileGroup(node.filePath);
    } else {
      const remainder = parts.slice(prefix.length);
      group = remainder.length > 1 ? remainder[0] : "root";
    }
    (directoryGroups[group] ||= []).push(node.id);
    groupById[node.id] = group;
  }

  const nodeTypeGroups = {};
  for (const node of fileNodes) (nodeTypeGroups[node.type] ||= []).push(node.id);

  const fileFanIn = Object.fromEntries(fileNodes.map((node) => [node.id, 0]));
  const fileFanOut = Object.fromEntries(fileNodes.map((node) => [node.id, 0]));
  const adjacency = Object.fromEntries(fileNodes.map((node) => [node.id, []]));
  const interMap = {};
  const groupImportsFrom = {};
  const groupImportedBy = {};
  for (const edge of importEdges) {
    fileFanOut[edge.source] += 1;
    fileFanIn[edge.target] += 1;
    adjacency[edge.source].push(edge.target);
    const from = groupById[edge.source];
    const to = groupById[edge.target];
    if (from !== to) {
      increment(interMap, `${from}\u0000${to}`);
      (groupImportsFrom[from] ||= new Set()).add(to);
      (groupImportedBy[to] ||= new Set()).add(from);
    }
  }

  const interGroupImports = Object.entries(interMap).map(([key, count]) => {
    const [from, to] = key.split("\u0000");
    return { from, to, count };
  }).sort((a, b) => b.count - a.count || a.from.localeCompare(b.from));

  const intraGroupDensity = {};
  for (const group of Object.keys(directoryGroups)) {
    let internalEdges = 0;
    let totalEdges = 0;
    for (const edge of importEdges) {
      const from = groupById[edge.source];
      const to = groupById[edge.target];
      if (from === group || to === group) totalEdges += 1;
      if (from === group && to === group) internalEdges += 1;
    }
    intraGroupDensity[group] = {
      internalEdges,
      totalEdges,
      density: totalEdges ? Number((internalEdges / totalEdges).toFixed(4)) : 0,
      importsFrom: [...(groupImportsFrom[group] || [])].sort(),
      importedBy: [...(groupImportedBy[group] || [])].sort(),
    };
  }

  const crossCounts = {};
  const nonCodeConnections = [];
  for (const edge of allEdges) {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    const key = `${source.type}\u0000${target.type}\u0000${edge.type}`;
    increment(crossCounts, key);
    if (source.type !== "file" || target.type !== "file") {
      nonCodeConnections.push({
        source: edge.source, target: edge.target, edgeType: edge.type,
      });
    }
  }
  const crossCategoryEdges = Object.entries(crossCounts).map(([key, count]) => {
    const [fromType, toType, edgeType] = key.split("\u0000");
    return { fromType, toType, edgeType, count };
  }).sort((a, b) => b.count - a.count);

  const patternMatches = {};
  const filePatternMatches = {};
  for (const group of Object.keys(directoryGroups)) patternMatches[group] = directoryPattern(group);
  for (const node of fileNodes) {
    const match = filePattern(node.filePath);
    if (match) filePatternMatches[node.id] = match;
  }

  const lowerPaths = paths.map((p) => p.toLowerCase());
  const infraFiles = fileNodes.filter((node) =>
    ["service", "resource", "pipeline"].includes(node.type)
    || ["infrastructure", "ci-cd"].includes(filePattern(node.filePath)),
  ).map((node) => node.filePath);
  const deploymentTopology = {
    hasDockerfile: lowerPaths.some((p) => /(^|\/)dockerfile/.test(p)),
    hasCompose: lowerPaths.some((p) => /(^|\/)docker-compose\./.test(p)),
    hasK8s: lowerPaths.some((p) => /(^|\/)(k8s|kubernetes|helm|charts)(\/|$)/.test(p)),
    hasTerraform: lowerPaths.some((p) => /\.(tf|tfvars)$/.test(p) || /(^|\/)terraform(\/|$)/.test(p)),
    hasCI: fileNodes.some((node) => node.type === "pipeline" || filePattern(node.filePath) === "ci-cd"),
    infraFiles,
  };

  const dataPipeline = {
    schemaFiles: fileNodes.filter((n) => n.type === "schema" || /\.(sql|graphql|gql|proto|prisma)$/i.test(n.filePath)).map((n) => n.filePath),
    migrationFiles: fileNodes.filter((n) => /(^|\/)migrations?\//i.test(normalized(n.filePath))).map((n) => n.filePath),
    dataModelFiles: fileNodes.filter((n) => /(^|\/)(models?|entities|data)\//i.test(normalized(n.filePath)) || (n.tags || []).some((t) => /model|entity|data/.test(t))).map((n) => n.filePath),
    apiHandlerFiles: fileNodes.filter((n) => /(^|\/)(routes?|api|controllers?|handlers?|endpoints?)\//i.test(normalized(n.filePath)) || n.type === "endpoint").map((n) => n.filePath),
  };

  const docNodes = fileNodes.filter((n) => n.type === "document" || /\.(md|rst)$/i.test(n.filePath));
  const documented = new Set();
  for (const node of docNodes) {
    const docPath = normalized(node.filePath);
    const docGroup = groupById[node.id];
    if (/readme\.md$/i.test(docPath) && docGroup) documented.add(docGroup);
    for (const group of Object.keys(directoryGroups)) {
      if (docPath.toLowerCase().includes(group.toLowerCase())) documented.add(group);
      const text = `${node.summary || ""} ${(node.tags || []).join(" ")}`.toLowerCase();
      if (text.includes(group.toLowerCase())) documented.add(group);
    }
  }
  const groups = Object.keys(directoryGroups);
  const docCoverage = {
    groupsWithDocs: documented.size,
    totalGroups: groups.length,
    coverageRatio: groups.length ? Number((documented.size / groups.length).toFixed(4)) : 0,
    undocumentedGroups: groups.filter((group) => !documented.has(group)),
  };

  const dependencyDirection = [];
  const seenPairs = new Set();
  for (const item of interGroupImports) {
    const pair = [item.from, item.to].sort();
    const pairKey = pair.join("\u0000");
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);
    const forward = interMap[`${pair[0]}\u0000${pair[1]}`] || 0;
    const reverse = interMap[`${pair[1]}\u0000${pair[0]}`] || 0;
    if (forward > reverse) dependencyDirection.push({ dependent: pair[0], dependsOn: pair[1], count: forward, reverseCount: reverse });
    else if (reverse > forward) dependencyDirection.push({ dependent: pair[1], dependsOn: pair[0], count: reverse, reverseCount: forward });
    else dependencyDirection.push({ dependent: pair[0], dependsOn: pair[1], count: forward, reverseCount: reverse, bidirectional: true });
  }

  const result = {
    scriptCompleted: true,
    commonPathPrefix: prefix.join("/"),
    directoryGroups,
    nodeTypeGroups,
    adjacency,
    crossCategoryEdges,
    nonCodeConnections,
    interGroupImports,
    intraGroupDensity,
    patternMatches,
    filePatternMatches,
    deploymentTopology,
    dataPipeline,
    docCoverage,
    dependencyDirection,
    fileStats: {
      totalFileNodes: fileNodes.length,
      filesPerGroup: Object.fromEntries(Object.entries(directoryGroups).map(([group, ids]) => [group, ids.length])),
      nodeTypeCounts: Object.fromEntries(Object.entries(nodeTypeGroups).map(([type, ids]) => [type, ids.length])),
    },
    fileFanIn,
    fileFanOut,
  };
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result.fileStats));
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
