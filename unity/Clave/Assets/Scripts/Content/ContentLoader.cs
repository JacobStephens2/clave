using System;
using System.IO;
using UnityEngine;

namespace Clave.Content
{
    public static class ContentLoader
    {
        public const string CardsFileName = "cards.json";
        public const string SongFileName = "song-lloraras.json";

        public static ContentSet Load()
        {
            var paths = ResolvePaths();
            if (!File.Exists(paths.cards) || !File.Exists(paths.song))
            {
                throw new FileNotFoundException(
                    "Clave content is missing. In the Editor, keep the Unity project inside the "
                    + "Clave repository. For a build, run Clave > Build macOS App so content is staged."
                );
            }

            return ContentSet.Parse(File.ReadAllText(paths.cards), File.ReadAllText(paths.song));
        }

        public static (string cards, string song) EditorSourcePaths()
        {
            var dataDirectory = Path.GetFullPath(
                Path.Combine(Application.dataPath, "../../../packages/content/src/data")
            );
            return (
                Path.Combine(dataDirectory, CardsFileName),
                Path.Combine(dataDirectory, SongFileName)
            );
        }

        private static (string cards, string song) ResolvePaths()
        {
            if (Application.isEditor) return EditorSourcePaths();
            var contentDirectory = Path.Combine(Application.streamingAssetsPath, "Content");
            return (
                Path.Combine(contentDirectory, CardsFileName),
                Path.Combine(contentDirectory, SongFileName)
            );
        }
    }
}
