using System.Linq;
using Clave.Content;
using Clave.Engine;
using NUnit.Framework;

namespace Clave.Tests
{
    public sealed class ClaveEngineTests
    {
        private ContentSet _content;

        [SetUp]
        public void SetUp()
        {
            _content = ContentLoader.Load();
        }

        [Test]
        public void LoadsTheSharedV1Content()
        {
            Assert.That(_content.Version, Is.EqualTo(1));
            Assert.That(_content.Cards.Count, Is.EqualTo(23));
            Assert.That(_content.Song.Cards.Count, Is.EqualTo(16));
            Assert.That(_content.Card("mov_003").Name, Is.EqualTo("Lead Right Turn"));
            Assert.That(_content.Card("mov_005").Positions, Is.EqualTo(new[] { "Open", "Half-Open" }));
            Assert.That(_content.Card("mov_013").Positions, Is.EqualTo(new[] { "Closed", "Half-Closed" }));
        }

        [Test]
        public void SameSeedProducesSameOpeningHands()
        {
            var left = new ClaveEngine(_content, 20260719);
            var right = new ClaveEngine(_content, 20260719);
            var leftIds = left.State.Player(Role.Lead).Hand.Select(card => card.CardId);
            var rightIds = right.State.Player(Role.Lead).Hand.Select(card => card.CardId);
            Assert.That(leftIds, Is.EqualTo(rightIds));
            Assert.That(left.State.RngState, Is.EqualTo(right.State.RngState));
        }

        [Test]
        public void RngMatchesTheTypeScriptEngineSequence()
        {
            uint state = 20260719;
            Assert.That(DeterministicRng.Next(ref state), Is.EqualTo(0.4065049833152443).Within(1e-12));
            Assert.That(state, Is.EqualTo(1851826532));
            Assert.That(DeterministicRng.Next(ref state), Is.EqualTo(0.32796062412671745).Within(1e-12));
            Assert.That(state, Is.EqualTo(3683392345));
        }

        [Test]
        public void SetupBeginsTheSongOnTheLeadsTurn()
        {
            var engine = ReadyGame();
            Assert.That(engine.State.Status, Is.EqualTo(GameStatus.Playing));
            Assert.That(engine.State.ActiveRole, Is.EqualTo(Role.Lead));
            Assert.That(engine.State.Phase, Is.EqualTo(TurnPhase.Dance));
            Assert.That(engine.State.SongIndex, Is.EqualTo(0));
            Assert.That(engine.State.Player(Role.Lead).Money, Is.EqualTo(1));
        }

        [Test]
        public void BasicsCanCompleteTheWholeSong()
        {
            var engine = ReadyGame();
            for (var count = 0; count < 16; count++)
            {
                var role = engine.State.ActiveRole;
                Apply(engine, new GameAction { Type = GameActionType.EndDance, Role = role });
                Apply(engine, new GameAction { Type = GameActionType.EndLesson, Role = role });
                Apply(engine, new GameAction { Type = GameActionType.Freshen, Role = role });
            }
            Assert.That(engine.State.Status, Is.EqualTo(GameStatus.Completed));
            Assert.That(engine.State.FinalScore, Is.Not.Null);
            Assert.That(engine.State.Rating, Is.Not.Empty);
        }

        [Test]
        public void SaveRoundTripPreservesTheTurn()
        {
            var engine = ReadyGame();
            var restored = new ClaveEngine(_content, ClaveEngine.DeserializeState(engine.SerializeState()));
            Assert.That(restored.State.GameId, Is.EqualTo(engine.State.GameId));
            Assert.That(restored.State.Sequence, Is.EqualTo(engine.State.Sequence));
            Assert.That(restored.State.ActiveRole, Is.EqualTo(engine.State.ActiveRole));
            Assert.That(restored.State.Player(Role.Lead).Hand.Select(card => card.CardId),
                Is.EqualTo(engine.State.Player(Role.Lead).Hand.Select(card => card.CardId)));
        }

        private ClaveEngine ReadyGame()
        {
            var engine = new ClaveEngine(_content, 20260719);
            Apply(engine, new GameAction { Type = GameActionType.ConfirmHand, Role = Role.Lead });
            Apply(engine, new GameAction { Type = GameActionType.ConfirmHand, Role = Role.Follow });
            return engine;
        }

        private static void Apply(ClaveEngine engine, GameAction action)
        {
            var result = engine.Apply(action);
            Assert.That(result.Ok, Is.True, result.Message);
        }
    }
}
