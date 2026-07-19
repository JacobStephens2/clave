using System;
using System.IO;
using Clave.Content;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UIElements;

namespace Clave.Editor
{
    public sealed class StageContentForBuild : IPreprocessBuildWithReport
    {
        public int callbackOrder => 0;

        public void OnPreprocessBuild(BuildReport report)
        {
            MacBuild.StageContent();
        }
    }

    public static class MacBuild
    {
        private const string MainScenePath = "Assets/Scenes/Main.unity";
        private const string PanelSettingsPath = "Assets/Resources/ClavePanelSettings.asset";

        [MenuItem("Clave/Validate shared content")]
        public static void ValidateSharedContent()
        {
            var content = ContentLoader.Load();
            Debug.Log($"Clave content v{content.Version}: {content.Cards.Count} cards, {content.Song.Cards.Count} song moments.");
        }

        [MenuItem("Clave/Stage shared content")]
        public static void StageContent()
        {
            var source = ContentLoader.EditorSourcePaths();
            if (!File.Exists(source.cards) || !File.Exists(source.song))
                throw new FileNotFoundException("Shared Clave content was not found in packages/content/src/data.");

            var destination = Path.Combine(Application.dataPath, "StreamingAssets/Content");
            Directory.CreateDirectory(destination);
            File.Copy(source.cards, Path.Combine(destination, ContentLoader.CardsFileName), true);
            File.Copy(source.song, Path.Combine(destination, ContentLoader.SongFileName), true);
            AssetDatabase.Refresh();
        }

        [MenuItem("Clave/Build macOS App")]
        public static void Build()
        {
            ValidateSharedContent();
            StageContent();
            EnsurePanelSettingsAsset();
            EnsureMainScene();
            ConfigurePlayer();

            var requestedPath = Environment.GetEnvironmentVariable("CLAVE_UNITY_BUILD_PATH");
            var buildPath = string.IsNullOrWhiteSpace(requestedPath)
                ? Path.GetFullPath(Path.Combine(Application.dataPath, "../Builds/macOS/Clave.app"))
                : Path.GetFullPath(requestedPath);
            Directory.CreateDirectory(Path.GetDirectoryName(buildPath) ?? throw new InvalidOperationException("Invalid build path."));

            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = new[] { MainScenePath },
                locationPathName = buildPath,
                target = BuildTarget.StandaloneOSX,
                targetGroup = BuildTargetGroup.Standalone,
                options = BuildOptions.None,
            });
            if (report.summary.result != BuildResult.Succeeded)
                throw new BuildFailedException($"Clave macOS build failed: {report.summary.result}");

            Debug.Log($"Clave macOS app built at {buildPath} ({report.summary.totalSize} bytes). ");
        }

        [MenuItem("Clave/Ensure UI panel settings")]
        public static PanelSettings EnsurePanelSettingsAsset()
        {
            Directory.CreateDirectory(Path.GetDirectoryName(PanelSettingsPath) ?? "Assets/Resources");
            var settings = AssetDatabase.LoadAssetAtPath<PanelSettings>(PanelSettingsPath);
            if (settings == null)
            {
                settings = ScriptableObject.CreateInstance<PanelSettings>();
                AssetDatabase.CreateAsset(settings, PanelSettingsPath);
            }

            settings.scaleMode = PanelScaleMode.ScaleWithScreenSize;
            settings.referenceResolution = new Vector2Int(1440, 900);
            settings.match = 0.5f;
            EditorUtility.SetDirty(settings);
            AssetDatabase.SaveAssets();
            AssetDatabase.ImportAsset(PanelSettingsPath);
            return settings;
        }

        private static void EnsureMainScene()
        {
            if (!File.Exists(MainScenePath))
            {
                Directory.CreateDirectory(Path.GetDirectoryName(MainScenePath) ?? "Assets/Scenes");
                var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                EditorSceneManager.SaveScene(scene, MainScenePath);
            }
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(MainScenePath, true) };
        }

        private static void ConfigurePlayer()
        {
            PlayerSettings.companyName = "Clave Dance Games";
            PlayerSettings.productName = "Clave";
            PlayerSettings.bundleVersion = "1.0.0-unity";
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Standalone, "dance.clave.macos");
            PlayerSettings.defaultScreenWidth = 1440;
            PlayerSettings.defaultScreenHeight = 900;
            PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
            PlayerSettings.resizableWindow = true;
            PlayerSettings.runInBackground = true;
        }
    }
}
