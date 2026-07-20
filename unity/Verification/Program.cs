using System;
using System.IO;
using System.Linq;
using Clave.Content;
using Clave.Engine;

internal static class Program
{
    private static ContentSet _content;
    private static int _checks;

    private static int Main()
    {
        try
        {
            var root = FindRepositoryRoot(Directory.GetCurrentDirectory());
            _content = ContentSet.Parse(
                File.ReadAllText(Path.Combine(root, "packages/content/src/data/cards.json")),
                File.ReadAllText(Path.Combine(root, "packages/content/src/data/song-lloraras.json"))
            );

            CheckContent();
            CheckRngParity();
            CheckDeterministicSetup();
            CheckPlayableOpening();
            CheckSaveRoundTrip();
            CheckCompleteGame();

            Console.WriteLine($"[unity:csharp] {_checks} compiled C# checks passed.");
            return 0;
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine($"[unity:csharp] {exception}");
            return 1;
        }
    }

    private static string FindRepositoryRoot(string start)
    {
        var current = new DirectoryInfo(start);
        while (current != null)
        {
            if (Directory.Exists(Path.Combine(current.FullName, "packages", "content")))
                return current.FullName;
            current = current.Parent;
        }
        throw new DirectoryNotFoundException($"Could not find repository root from {start}.");
    }

    private static void CheckContent()
    {
        Assert(_content.Version == 1, "content version");
        Assert(_content.Cards.Count == 23, "dance card count");
        Assert(_content.Song.Cards.Count == 16, "song card count");
        Assert(_content.Card("mov_003").Name == "Lead Right Turn", "card lookup");
        Assert(
            _content.Card("mov_005").Positions.SequenceEqual(new[] { "Open", "Half-Open" }),
            "open Cross Body Lead entries"
        );
        Assert(
            _content.Card("mov_013").Positions.SequenceEqual(new[] { "Closed", "Half-Closed" }),
            "closed Cross Body Lead entries"
        );
    }

    private static void CheckRngParity()
    {
        uint state = 20260719;
        Assert(Math.Abs(DeterministicRng.Next(ref state) - 0.4065049833152443) < 1e-12, "first RNG value");
        Assert(state == 1851826532, "first RNG state");
        Assert(Math.Abs(DeterministicRng.Next(ref state) - 0.32796062412671745) < 1e-12, "second RNG value");
        Assert(state == 3683392345, "second RNG state");
    }

    private static void CheckDeterministicSetup()
    {
        var left = new ClaveEngine(_content, 20260719);
        var right = new ClaveEngine(_content, 20260719);
        Assert(
            left.State.Player(Role.Lead).Hand.Select(card => card.CardId).SequenceEqual(
                right.State.Player(Role.Lead).Hand.Select(card => card.CardId)
            ),
            "same-seed opening hand"
        );
        Assert(left.State.RngState == right.State.RngState, "same-seed RNG state");
    }

    private static void CheckPlayableOpening()
    {
        var engine = ReadyGame();
        var opening = engine.LegalActions(Role.Lead).FirstOrDefault(action => action.Type == GameActionType.PlayOpen);
        Assert(opening != null, "seeded hand has a legal opening");
        Apply(engine, opening);
        Assert(engine.State.Table.Position != null, "opening establishes position");
        Assert(engine.State.Table.Move != null, "opening establishes move");
        Assert(engine.State.Shared.Style > 0, "opening scores move style");
        Assert(engine.LegalActions(Role.Lead).Any(action => action.Type == GameActionType.UndoTurn), "opening enables undo");
    }

    private static void CheckSaveRoundTrip()
    {
        var engine = ReadyGame();
        var restored = new ClaveEngine(_content, ClaveEngine.DeserializeState(engine.SerializeState()));
        Assert(restored.State.GameId == engine.State.GameId, "save game id");
        Assert(restored.State.Sequence == engine.State.Sequence, "save sequence");
        Assert(
            restored.State.Player(Role.Lead).Hand.Select(card => card.CardId).SequenceEqual(
                engine.State.Player(Role.Lead).Hand.Select(card => card.CardId)
            ),
            "save hand"
        );
    }

    private static void CheckCompleteGame()
    {
        var engine = ReadyGame();
        for (var count = 0; count < 16; count++)
        {
            var role = engine.State.ActiveRole;
            Apply(engine, new GameAction { Type = GameActionType.EndDance, Role = role });
            Apply(engine, new GameAction { Type = GameActionType.EndLesson, Role = role });
            Apply(engine, new GameAction { Type = GameActionType.Freshen, Role = role });
        }
        Assert(engine.State.Status == GameStatus.Completed, "complete sixteen-count game");
        Assert(engine.State.FinalScore.HasValue, "final score");
        Assert(!string.IsNullOrWhiteSpace(engine.State.Rating), "final rating");
    }

    private static ClaveEngine ReadyGame()
    {
        var engine = new ClaveEngine(_content, 20260719);
        Apply(engine, new GameAction { Type = GameActionType.ConfirmHand, Role = Role.Lead });
        Apply(engine, new GameAction { Type = GameActionType.ConfirmHand, Role = Role.Follow });
        Assert(engine.State.Status == GameStatus.Playing, "setup status");
        Assert(engine.State.ActiveRole == Role.Lead, "setup active role");
        Assert(engine.State.SongIndex == 0, "setup song index");
        return engine;
    }

    private static void Apply(ClaveEngine engine, GameAction action)
    {
        var result = engine.Apply(action);
        if (!result.Ok) throw new InvalidOperationException($"{result.Code}: {result.Message}");
    }

    private static void Assert(bool condition, string label)
    {
        _checks++;
        if (!condition) throw new InvalidOperationException($"Check failed: {label}.");
    }
}
