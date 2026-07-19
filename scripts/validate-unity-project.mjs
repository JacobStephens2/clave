import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const unityRoot = path.join(root, "unity", "Clave");
const expectedFiles = [
  "ProjectSettings/ProjectVersion.txt",
  "Packages/manifest.json",
  "Assets/Scripts/Clave.Runtime.asmdef",
  "Assets/Scripts/Content/ContentModels.cs",
  "Assets/Scripts/Content/ContentLoader.cs",
  "Assets/Scripts/Engine/GameModels.cs",
  "Assets/Scripts/Engine/DeterministicRng.cs",
  "Assets/Scripts/Engine/ClaveEngine.cs",
  "Assets/Scripts/Presentation/GamePersistence.cs",
  "Assets/Scripts/Presentation/ClaveApp.cs",
  "Assets/Resources/Clave.uss",
  "Assets/Resources/ClavePanelSettings.asset",
  "Assets/Editor/MacBuild.cs",
  "Assets/Tests/EditMode/ClaveEngineTests.cs",
];

const fail = (message) => {
  throw new Error(`[unity] ${message}`);
};

for (const relative of expectedFiles) {
  if (!fs.existsSync(path.join(unityRoot, relative))) fail(`Missing ${relative}.`);
}

const projectVersion = fs.readFileSync(
  path.join(unityRoot, "ProjectSettings", "ProjectVersion.txt"),
  "utf8",
);
if (!projectVersion.includes("6000.5.")) fail("Project must target the Unity 6.5 line.");

const manifest = JSON.parse(
  fs.readFileSync(path.join(unityRoot, "Packages", "manifest.json"), "utf8"),
);
if (manifest.dependencies["com.unity.nuget.newtonsoft-json"] !== "3.2.1") {
  fail("Unity Newtonsoft JSON dependency is missing or unexpected.");
}
if (!manifest.dependencies["com.unity.test-framework"]) fail("Unity Test Framework is missing.");

const cards = JSON.parse(
  fs.readFileSync(path.join(root, "packages", "content", "src", "data", "cards.json"), "utf8"),
);
const song = JSON.parse(
  fs.readFileSync(
    path.join(root, "packages", "content", "src", "data", "song-lloraras.json"),
    "utf8",
  ),
);
const cardIds = new Set(cards.cards.map((card) => card.id));
if (cardIds.size !== cards.cards.length) fail("Shared content contains duplicate card ids.");
if (song.cards.length !== 16) fail("Unity version requires the 16-card Llorarás song.");
if (new Set(song.cards.map((card) => card.id)).size !== 16) fail("Song ids must be unique.");

const deckIds = [
  ...cards.decks.starter.map((entry) => entry.cardId),
  ...cards.decks.beginnerSupply,
  ...cards.decks.intermediate.map((entry) => entry.cardId),
  ...cards.decks.advanced.map((entry) => entry.cardId),
  ...cards.decks.full.lead.map((entry) => entry.cardId),
  ...cards.decks.full.follow.map((entry) => entry.cardId),
];
for (const id of deckIds) if (!cardIds.has(id)) fail(`Deck references unknown card ${id}.`);

const expectedActions = [
  "Mulligan",
  "ConfirmHand",
  "PlayOpen",
  "PlayMove",
  "Transition",
  "PlayFlourish",
  "EndDance",
  "Stumble",
  "BuyLesson",
  "LearnFromPartner",
  "EndLesson",
  "Freshen",
  "SignalCard",
  "ClearSignal",
  "UndoTurn",
];
const models = fs.readFileSync(
  path.join(unityRoot, "Assets", "Scripts", "Engine", "GameModels.cs"),
  "utf8",
);
const engine = fs.readFileSync(
  path.join(unityRoot, "Assets", "Scripts", "Engine", "ClaveEngine.cs"),
  "utf8",
);
const presentation = fs.readFileSync(
  path.join(unityRoot, "Assets", "Scripts", "Presentation", "ClaveApp.cs"),
  "utf8",
);
const presentationStyles = fs.readFileSync(
  path.join(unityRoot, "Assets", "Resources", "Clave.uss"),
  "utf8",
);
for (const action of expectedActions) {
  if (!models.includes(`${action},`)) fail(`GameActionType is missing ${action}.`);
  if (!engine.includes(`GameActionType.${action}`)) fail(`C# engine does not handle ${action}.`);
}

for (const dragFeature of [
  "PointerDownEvent",
  "PointerMoveEvent",
  "PointerUpEvent",
  "worldBound.Contains",
  "PlayDroppedCard",
  "_pendingOpenPositionInstanceId",
  "CancelStagedPosition",
]) {
  if (!presentation.includes(dragFeature))
    fail(`Unity presentation is missing drag feature ${dragFeature}.`);
}
if (presentation.includes("BuildDropChoiceOverlay")) {
  fail("Unity opening drag flow must not fall back to a click-choice dialog.");
}
for (const lessonAnimationFeature of [
  "BuyLessonWithAnimation",
  "StartLessonFlight",
  "Time.realtimeSinceStartup",
  "_discardPileTarget",
]) {
  if (!presentation.includes(lessonAnimationFeature))
    fail(`Unity presentation is missing lesson animation feature ${lessonAnimationFeature}.`);
}
for (const lessonAnimationStyle of ["lesson-flight-card", "discard-pile-target.receiving"]) {
  if (!presentationStyles.includes(lessonAnimationStyle))
    fail(`Unity styles are missing lesson animation style ${lessonAnimationStyle}.`);
}
for (const dancerFeature of [
  "BuildDancerDemo",
  "DancerDemoMode.Position",
  "DancerDemoMode.Move",
  "DancerDemoMode.Flourish",
  "AnimateDancerDemo",
  "Angle.Degrees",
]) {
  if (!presentation.includes(dancerFeature))
    fail(`Unity presentation is missing dancer sample feature ${dancerFeature}.`);
}
for (const dancerStyle of [
  "dancer-demo-stage",
  "dancer-figure",
  "dancer-limb",
  "dancer-mode-button.selected",
]) {
  if (!presentationStyles.includes(dancerStyle))
    fail(`Unity styles are missing dancer sample style ${dancerStyle}.`);
}

const csharpFiles = fs
  .readdirSync(path.join(unityRoot, "Assets"), { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".cs"))
  .map((entry) => path.join(entry.parentPath, entry.name));

const authoredAssets = fs
  .readdirSync(path.join(unityRoot, "Assets"), { recursive: true, withFileTypes: true })
  .filter(
    (entry) =>
      entry.isFile() &&
      !entry.name.endsWith(".meta") &&
      [".cs", ".asmdef", ".uss"].includes(path.extname(entry.name)),
  )
  .map((entry) => path.join(entry.parentPath, entry.name));
const guids = new Set();
for (const asset of authoredAssets) {
  const meta = `${asset}.meta`;
  if (!fs.existsSync(meta)) fail(`Authored Unity asset is missing metadata: ${asset}.`);
  const match = fs.readFileSync(meta, "utf8").match(/^guid: ([a-f0-9]{32})$/m);
  if (!match) fail(`Unity metadata has no valid guid: ${meta}.`);
  if (guids.has(match[1])) fail(`Duplicate Unity asset guid ${match[1]}.`);
  guids.add(match[1]);
}

const assertBalanced = (file) => {
  const source = fs.readFileSync(file, "utf8");
  const pairs = new Map([
    ["}", "{"],
    [")", "("],
    ["]", "["],
  ]);
  const stack = [];
  let mode = "code";
  for (let index = 0; index < source.length; index += 1) {
    const value = source[index];
    const next = source[index + 1];
    if (mode === "line") {
      if (value === "\n") mode = "code";
      continue;
    }
    if (mode === "block") {
      if (value === "*" && next === "/") {
        mode = "code";
        index += 1;
      }
      continue;
    }
    if (mode === "string") {
      if (value === "\\") index += 1;
      else if (value === '"') mode = "code";
      continue;
    }
    if (mode === "char") {
      if (value === "\\") index += 1;
      else if (value === "'") mode = "code";
      continue;
    }
    if (value === "/" && next === "/") {
      mode = "line";
      index += 1;
    } else if (value === "/" && next === "*") {
      mode = "block";
      index += 1;
    } else if (value === '"') mode = "string";
    else if (value === "'") mode = "char";
    else if (["{", "(", "["].includes(value)) stack.push(value);
    else if (pairs.has(value) && stack.pop() !== pairs.get(value))
      fail(`Unbalanced ${value} in ${file}.`);
  }
  if (mode === "string" || mode === "char" || mode === "block" || stack.length > 0) {
    fail(`Unclosed token in ${file}.`);
  }
};

for (const file of csharpFiles) assertBalanced(file);

const stagedContent = path.join(unityRoot, "Assets", "StreamingAssets", "Content");
if (fs.existsSync(stagedContent)) {
  const tracked = execFileSync("git", ["ls-files", "--", stagedContent], {
    cwd: root,
    encoding: "utf8",
  })
    .split(/\r?\n/u)
    .filter((name) => name.endsWith(".json"));
  if (tracked.length > 0)
    fail("Generated StreamingAssets content should not be tracked in source.");
}

process.stdout.write(
  `[unity] Unity 6.5 project verified: ${csharpFiles.length} C# files, ${cards.cards.length} cards, ${song.cards.length} song moments.\n`,
);
