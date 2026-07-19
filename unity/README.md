# Clave for macOS — Unity + C#

This is a parallel, macOS-first implementation of Clave. It does not replace the
web v1. It uses Unity UI Toolkit for the desktop table and a deterministic,
headless C# rules layer for hot-seat play.

## What is included

- Full 16-count Llorarás hot-seat turn loop
- Opening hands and legal mulligans
- Positions, Moves, transitions, Flourishes, basics, stumbles, and Recovery cards
- All data-driven song and phrase bonuses
- Beginner, Intermediate, and Advanced lessons plus partner learning
- Deterministic seeded shuffles, undo, private pass screens, signaling, save/resume
- Wide 1440 × 900 layout with the floor, action strip, full hand, lessons, and log
- Drag a Position to the floor, then drag a highlighted matching Move to complete the opening play
- Purchased lesson cards arc from the market into the player's discard pile
- Card detail overlay when a card is clicked
- Automated macOS `.app` build menu/CLI method

The Unity project reads the same source-of-truth JSON as the web game from
`packages/content/src/data`. The macOS build step stages those files into
`StreamingAssets`; generated copies are intentionally ignored by Git.

## Open in Unity Hub

1. In Unity Hub, install **Unity 6.5 (6000.5.4f1)** with **Mac Build Support**.
2. Choose **Add > Add project from disk** and select `unity/Clave`.
3. Open the project. Unity will create its normal `Library` and settings files.
4. Enter Play Mode from any empty scene. `ClaveApp` bootstraps itself automatically.

The project records `6000.5.4f1` in `ProjectVersion.txt` to match the editor used
to compile, test, and build this version.

## Build the macOS app

From the Editor, choose **Clave > Build macOS App**. The default output is:

```text
unity/Clave/Builds/macOS/Clave.app
```

For a repeatable command-line build:

```sh
/Applications/Unity/Hub/Editor/6000.5.4f1/Unity.app/Contents/MacOS/Unity \
  -batchmode -quit \
  -projectPath "$PWD/unity/Clave" \
  -executeMethod Clave.Editor.MacBuild.Build \
  -logFile "$PWD/unity/Clave/Logs/mac-build.log"
```

Set `CLAVE_UNITY_BUILD_PATH` to override the `.app` destination.

## Verification

Repository-side structural and content verification (does not require Unity):

```sh
npm run check:unity
```

Compile and run the headless C# engine checks with .NET 8:

```sh
npm run check:unity:csharp
```

If .NET is not installed locally, the repository can use Docker without changing
the host system:

```sh
docker run --rm -v "$PWD:/repo" -w /repo mcr.microsoft.com/dotnet/sdk:8.0 \
  dotnet run --project unity/Verification/Clave.Engine.Verification.csproj
```

After the editor is installed, run **Window > General > Test Runner > EditMode**,
then build once with the command above. The Unity-generated content, Library,
logs, and app builds remain ignored.
