using System;
using System.IO;
using Clave.Content;
using Clave.Engine;
using UnityEngine;

namespace Clave.Presentation
{
    public static class GamePersistence
    {
        private const string SaveFileName = "hotseat-v1.json";
        private static string SavePath => Path.Combine(Application.persistentDataPath, SaveFileName);

        public static bool HasSave => File.Exists(SavePath);

        public static void Save(ClaveEngine engine)
        {
            var directory = Path.GetDirectoryName(SavePath);
            if (!string.IsNullOrEmpty(directory)) Directory.CreateDirectory(directory);
            var temporary = SavePath + ".tmp";
            File.WriteAllText(temporary, engine.SerializeState());
            if (File.Exists(SavePath)) File.Delete(SavePath);
            File.Move(temporary, SavePath);
        }

        public static ClaveEngine Load(ContentSet content)
        {
            if (!HasSave) throw new InvalidOperationException("There is no saved dance.");
            return new ClaveEngine(content, ClaveEngine.DeserializeState(File.ReadAllText(SavePath)));
        }

        public static void Delete()
        {
            if (File.Exists(SavePath)) File.Delete(SavePath);
        }
    }
}
