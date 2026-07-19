using System;
using System.Collections.Generic;
using System.Linq;
using Clave.Content;
using Newtonsoft.Json;

namespace Clave.Engine
{
    public sealed class ClaveEngine
    {
        private sealed class RuleException : Exception
        {
            public readonly string Code;

            public RuleException(string code, string message)
                : base(message)
            {
                Code = code;
            }
        }

        public ContentSet Content { get; }
        public GameState State { get; private set; }

        public ClaveEngine(ContentSet content, uint seed)
        {
            Content = content ?? throw new ArgumentNullException(nameof(content));
            State = CreateGame(seed);
        }

        public ClaveEngine(ContentSet content, GameState state)
        {
            Content = content ?? throw new ArgumentNullException(nameof(content));
            State = state ?? throw new ArgumentNullException(nameof(state));
            if (state.Version != GameState.EngineVersion)
                throw new InvalidOperationException("This save was created by another engine version.");
        }

        public ApplyResult Apply(GameAction action)
        {
            var next = Clone(State);
            try
            {
                HandleAction(next, action);
                next.Sequence = State.Sequence + 1;
                State = next;
                return ApplyResult.Success();
            }
            catch (RuleException error)
            {
                return ApplyResult.Failure(error.Code, error.Message);
            }
        }

        public IReadOnlyList<GameAction> LegalActions(Role role)
        {
            var state = State;
            if (state.Status == GameStatus.Setup)
            {
                if (state.SetupRole != role) return Array.Empty<GameAction>();
                var setup = new List<GameAction>();
                if (!state.Player(role).MulliganUsed && CanMulligan(state.Player(role)))
                    setup.Add(Action(GameActionType.Mulligan, role));
                setup.Add(Action(GameActionType.ConfirmHand, role));
                return setup;
            }

            if (state.Status != GameStatus.Playing || state.ActiveRole != role)
                return Array.Empty<GameAction>();

            var actions = new List<GameAction>();
            var player = state.Player(role);
            foreach (var entry in player.Hand)
                actions.Add(new GameAction
                {
                    Type = GameActionType.SignalCard,
                    Role = role,
                    InstanceId = entry.InstanceId,
                });
            if (state.Signal?.Role == role) actions.Add(Action(GameActionType.ClearSignal, role));
            if (state.Checkpoint != null && state.Sequence > state.Checkpoint.Sequence)
                actions.Add(Action(GameActionType.UndoTurn, role));

            if (state.Phase == TurnPhase.Dance) AddDanceActions(actions, state, player, role);
            if (state.Phase == TurnPhase.Lesson) AddLessonActions(actions, state, player, role);
            if (state.Phase == TurnPhase.Freshen)
                actions.Add(Action(GameActionType.Freshen, role));
            return actions;
        }

        public string SerializeState() => JsonConvert.SerializeObject(State, Formatting.None);

        public static GameState DeserializeState(string json)
        {
            return JsonConvert.DeserializeObject<GameState>(json)
                ?? throw new InvalidOperationException("The Clave save is empty or invalid.");
        }

        private GameState CreateGame(uint seed)
        {
            var state = new GameState
            {
                GameId = $"clave-unity-{seed}",
                Seed = seed,
                RngState = seed,
                Status = GameStatus.Setup,
                ActiveRole = Role.Lead,
                SetupRole = Role.Lead,
                Phase = TurnPhase.Mulligan,
                Shared = new SharedScore
                {
                    Connection = Content.Rules.InitialConnection,
                    Style = Content.Rules.InitialStyle,
                },
            };
            state.Players[Role.Lead] = MakePlayer(state, Role.Lead);
            state.Players[Role.Follow] = MakePlayer(state, Role.Follow);

            state.Market.IntermediateDeck = DeterministicRng.Shuffle(
                Expand(Content.Decks.Intermediate),
                ref state.RngState
            );
            state.Market.AdvancedDeck = DeterministicRng.Shuffle(
                Expand(Content.Decks.Advanced),
                ref state.RngState
            );
            state.Market.IntermediateDisplay = Take(state.Market.IntermediateDeck, 3);
            Log(state, "system", "The floor is ready. Lead checks their opening hand first.");
            return state;
        }

        private PlayerState MakePlayer(GameState state, Role role)
        {
            var instances = Expand(Content.Decks.Starter)
                .Select(cardId => NewOwnedInstance(state, role, cardId))
                .ToList();
            var shuffled = DeterministicRng.Shuffle(instances, ref state.RngState);
            return new PlayerState
            {
                Role = role,
                Hand = shuffled.Take(Content.Rules.HandSize).ToList(),
                DrawPile = shuffled.Skip(Content.Rules.HandSize).ToList(),
                Money = Content.Rules.StartingMoney,
            };
        }

        private void AddDanceActions(
            ICollection<GameAction> actions,
            GameState state,
            PlayerState player,
            Role role
        )
        {
            var positions = player.Hand.Where(entry => Card(entry).Type == "position").ToList();
            var moves = player.Hand.Where(entry => Card(entry).Type == "move").ToList();
            if (state.Table.Position == null)
            {
                foreach (var position in positions)
                {
                    foreach (var move in moves.Where(move => Card(move).MatchesPosition(Card(position).Position)))
                    {
                        actions.Add(new GameAction
                        {
                            Type = GameActionType.PlayOpen,
                            Role = role,
                            PositionInstanceId = position.InstanceId,
                            MoveInstanceId = move.InstanceId,
                        });
                    }
                }
            }
            else if (state.TurnDance.MoveCardId == null)
            {
                var currentPosition = PositionFor(state.Table.Position);
                foreach (var move in moves.Where(move => Card(move).MatchesPosition(currentPosition)))
                {
                    actions.Add(new GameAction
                    {
                        Type = GameActionType.PlayMove,
                        Role = role,
                        MoveInstanceId = move.InstanceId,
                    });
                }
            }

            if (
                state.TurnDance.CanTransition
                && state.TurnDance.PositionsPlayed < Content.Rules.DanceLimits.Positions
            )
            {
                foreach (var position in positions)
                {
                    actions.Add(new GameAction
                    {
                        Type = GameActionType.Transition,
                        Role = role,
                        PositionInstanceId = position.InstanceId,
                    });
                }
            }

            if (state.TurnDance.MoveCardId != null && !state.TurnDance.Flourished)
            {
                foreach (
                    var flourish in player.Hand.Where(entry =>
                        Card(entry).Type == "flourish"
                        && Card(entry).MatchesPosition(state.TurnDance.FromPosition)
                    )
                )
                {
                    actions.Add(new GameAction
                    {
                        Type = GameActionType.PlayFlourish,
                        Role = role,
                        FlourishInstanceId = flourish.InstanceId,
                    });
                }
            }

            if (state.TurnDance.CardsPlayed == 0)
            {
                actions.Add(Action(GameActionType.Stumble, role));
                foreach (var recovery in player.Hand.Where(entry => Card(entry).Type == "recovery"))
                {
                    actions.Add(new GameAction
                    {
                        Type = GameActionType.Stumble,
                        Role = role,
                        RecoveryInstanceId = recovery.InstanceId,
                    });
                }
            }
            actions.Add(Action(GameActionType.EndDance, role));
        }

        private void AddLessonActions(
            ICollection<GameAction> actions,
            GameState state,
            PlayerState player,
            Role role
        )
        {
            if (!state.TurnDance.BoughtLesson)
            {
                if (player.Money >= Content.Rules.LessonCosts.Beginner)
                {
                    foreach (var cardId in Content.Decks.BeginnerSupply)
                        actions.Add(BuyAction(role, "beginner", cardId));
                }
                if (
                    !state.Phrase.PrivateLessonTakenThisRound
                    && player.Money >= Content.Rules.LessonCosts.Intermediate
                )
                {
                    foreach (var cardId in state.Market.IntermediateDisplay)
                        actions.Add(BuyAction(role, "intermediate", cardId));
                    if (
                        state.SongIndex >= Content.Song.Cards.Count / 2
                        && player.Money >= Content.Rules.LessonCosts.Advanced
                    )
                    {
                        foreach (var cardId in state.Market.AdvancedDisplay)
                            actions.Add(BuyAction(role, "advanced", cardId));
                    }
                }
            }

            if (!state.Phrase.LearnedBy.Get(role))
            {
                foreach (
                    var cardId in state.MoveHistory
                        .Where(entry =>
                            entry.Role == Other(role)
                            && entry.Phrase == state.Phrase.Number
                            && entry.SongIndex < state.SongIndex
                        )
                        .Select(entry => entry.CardId)
                        .Distinct()
                )
                {
                    actions.Add(new GameAction
                    {
                        Type = GameActionType.LearnFromPartner,
                        Role = role,
                        CardId = cardId,
                    });
                }
            }
            actions.Add(Action(GameActionType.EndLesson, role));
        }

        private void HandleAction(GameState state, GameAction action)
        {
            Require(action != null, "INVALID_ACTION", "Choose an action.");
            var role = action.Role;
            var player = state.Player(role);

            if (action.Type is GameActionType.Mulligan or GameActionType.ConfirmHand)
            {
                HandleSetupAction(state, action, player);
                return;
            }

            Require(state.Status == GameStatus.Playing, "GAME_NOT_PLAYING", "The dance is not active.");
            Require(state.ActiveRole == role, "NOT_YOUR_TURN", "It is your partner's turn.");

            switch (action.Type)
            {
                case GameActionType.SignalCard:
                    InstanceFromHand(player, action.InstanceId);
                    state.Signal = new SignalState { Role = role, InstanceId = action.InstanceId };
                    Log(state, "signal", $"{RoleName(role)} reveals one card as a signal.", role);
                    return;
                case GameActionType.ClearSignal:
                    Require(state.Signal?.Role == role, "NO_SIGNAL", "There is no signal to clear.");
                    state.Signal = null;
                    return;
                case GameActionType.UndoTurn:
                    RestoreCheckpoint(state);
                    Log(state, "system", $"{RoleName(role)} resets their turn.", role);
                    return;
                case GameActionType.PlayOpen:
                    PlayOpen(state, action, player, role);
                    return;
                case GameActionType.PlayMove:
                    PlayMove(state, action, player, role);
                    return;
                case GameActionType.Transition:
                    Transition(state, action, player, role);
                    return;
                case GameActionType.PlayFlourish:
                    PlayFlourish(state, action, player, role);
                    return;
                case GameActionType.EndDance:
                    Require(state.Phase == TurnPhase.Dance, "WRONG_PHASE", "The dance step is complete.");
                    FinishDance(state, role);
                    return;
                case GameActionType.Stumble:
                    Stumble(state, action, player, role);
                    return;
                case GameActionType.BuyLesson:
                    BuyLesson(state, action, player, role);
                    return;
                case GameActionType.LearnFromPartner:
                    LearnFromPartner(state, action, player, role);
                    return;
                case GameActionType.EndLesson:
                    Require(state.Phase == TurnPhase.Lesson, "WRONG_PHASE", "The lesson step is complete.");
                    state.Phase = TurnPhase.Freshen;
                    return;
                case GameActionType.Freshen:
                    Freshen(state, action, player, role);
                    return;
                default:
                    throw new RuleException("UNKNOWN_ACTION", $"Unknown action {action.Type}.");
            }
        }

        private void HandleSetupAction(GameState state, GameAction action, PlayerState player)
        {
            Require(
                state.Status == GameStatus.Setup && state.Phase == TurnPhase.Mulligan,
                "WRONG_PHASE",
                "Opening hands are already settled."
            );
            Require(state.SetupRole == action.Role, "NOT_YOUR_SETUP", "Your partner checks first.");
            if (action.Type == GameActionType.Mulligan)
            {
                Require(!player.MulliganUsed, "MULLIGAN_USED", "The mulligan has already been used.");
                Require(CanMulligan(player), "MULLIGAN_NOT_ALLOWED", "This hand can already open.");
                player.Hand.AddRange(player.DrawPile);
                var shuffled = DeterministicRng.Shuffle(player.Hand, ref state.RngState);
                player.Hand = shuffled.Take(Content.Rules.HandSize).ToList();
                player.DrawPile = shuffled.Skip(Content.Rules.HandSize).ToList();
                player.MulliganUsed = true;
                Log(state, "system", $"{RoleName(action.Role)} takes their one mulligan.", action.Role);
                return;
            }

            player.Ready = true;
            Log(state, "system", $"{RoleName(action.Role)} keeps their opening hand.", action.Role);
            if (action.Role == Role.Lead)
            {
                state.SetupRole = Role.Follow;
                state.ActiveRole = Role.Follow;
            }
            else
            {
                state.Status = GameStatus.Playing;
                state.SetupRole = Role.Lead;
                StartTurn(state, Role.Lead);
            }
        }

        private void PlayOpen(GameState state, GameAction action, PlayerState player, Role role)
        {
            Require(state.Phase == TurnPhase.Dance, "WRONG_PHASE", "Dance during the dance step.");
            Require(state.Table.Position == null, "DANCE_ALREADY_OPEN", "The dance is already open.");
            Require(state.TurnDance.CardsPlayed == 0, "OPEN_FIRST", "Open with Position + Move.");
            var positionInstance = InstanceFromHand(player, action.PositionInstanceId);
            var moveInstance = InstanceFromHand(player, action.MoveInstanceId);
            Require(positionInstance != moveInstance, "SAME_CARD", "Choose two different cards.");
            var position = PositionFor(positionInstance);
            var move = Card(moveInstance);
            Require(move.Type == "move", "NOT_A_MOVE", "Choose a Move card.");
            Require(move.MatchesPosition(position), "POSITION_MISMATCH", $"{move.Name} cannot use {position}.");
            state.Table.Position = RemoveFromHand(player, positionInstance.InstanceId);
            state.TurnDance.PositionsPlayed++;
            state.TurnDance.CardsPlayed++;
            RecordMove(state, role, RemoveFromHand(player, moveInstance.InstanceId), position, move);
        }

        private void PlayMove(GameState state, GameAction action, PlayerState player, Role role)
        {
            Require(state.Phase == TurnPhase.Dance, "WRONG_PHASE", "Dance during the dance step.");
            Require(state.Table.Position != null, "OPEN_REQUIRED", "Open the dance first.");
            Require(state.TurnDance.MoveCardId == null, "MOVE_LIMIT", "Only one Move per turn.");
            var instance = InstanceFromHand(player, action.MoveInstanceId);
            var move = Card(instance);
            var fromPosition = PositionFor(state.Table.Position);
            Require(move.Type == "move", "NOT_A_MOVE", "Choose a Move card.");
            Require(move.MatchesPosition(fromPosition), "POSITION_MISMATCH", $"{move.Name} cannot use {fromPosition}.");
            RecordMove(state, role, RemoveFromHand(player, instance.InstanceId), fromPosition, move);
        }

        private void Transition(GameState state, GameAction action, PlayerState player, Role role)
        {
            Require(state.Phase == TurnPhase.Dance, "WRONG_PHASE", "Dance during the dance step.");
            Require(state.TurnDance.CanTransition, "TRANSITION_WINDOW_CLOSED", "Transition after your Move.");
            Require(
                state.TurnDance.PositionsPlayed < Content.Rules.DanceLimits.Positions,
                "POSITION_LIMIT",
                "The Position limit is reached."
            );
            var instance = InstanceFromHand(player, action.PositionInstanceId);
            var nextPosition = PositionFor(instance);
            var previousPosition = state.Table.Position == null ? null : PositionFor(state.Table.Position);
            if (state.Table.Position != null)
                state.Player(state.Table.Position.Owner).DiscardPile.Add(state.Table.Position);
            state.Table.Position = RemoveFromHand(player, instance.InstanceId);
            state.TurnDance.CardsPlayed++;
            state.TurnDance.PositionsPlayed++;
            state.TurnDance.ChangedPosition |= previousPosition != nextPosition;
            state.TurnDance.CanTransition = false;
            Log(state, "dance", $"{RoleName(role)} carries the dance to {nextPosition}.", role);
        }

        private void PlayFlourish(GameState state, GameAction action, PlayerState player, Role role)
        {
            Require(state.Phase == TurnPhase.Dance, "WRONG_PHASE", "Dance during the dance step.");
            Require(state.TurnDance.MoveCardId != null, "MOVE_REQUIRED", "Play a Move first.");
            Require(!state.TurnDance.Flourished, "FLOURISH_LIMIT", "Only one Flourish per turn.");
            var instance = InstanceFromHand(player, action.FlourishInstanceId);
            var flourish = Card(instance);
            Require(flourish.Type == "flourish", "NOT_A_FLOURISH", "Choose a Flourish card.");
            Require(
                flourish.MatchesPosition(state.TurnDance.FromPosition),
                "FLOURISH_MISMATCH",
                $"{flourish.Name} does not match {state.TurnDance.FromPosition}."
            );
            state.Table.Flourish = RemoveFromHand(player, instance.InstanceId);
            state.Shared.Style += flourish.Style;
            state.TurnDance.CardsPlayed++;
            state.TurnDance.Flourished = true;
            state.TurnDance.PosePlayed = flourish.Pose;
            state.TurnDance.CanTransition = false;
            state.Phrase.FlourishedBy.Set(role, true);
            if (flourish.Pose && (state.SongIndex + 1) % PhraseLength == 0)
                state.Phrase.PoseOnFinalCount = true;
            Log(state, "dance", $"{RoleName(role)} adds {flourish.Name} for {flourish.Style} Style.", role);
        }

        private void Stumble(GameState state, GameAction action, PlayerState player, Role role)
        {
            Require(state.Phase == TurnPhase.Dance, "WRONG_PHASE", "A stumble replaces the dance step.");
            Require(state.TurnDance.CardsPlayed == 0, "ALREADY_DANCED", "You already played cards.");
            var connectionCost = Content.Rules.Stumble.DefaultConnectionCost;
            if (!string.IsNullOrEmpty(action.RecoveryInstanceId))
            {
                var instance = InstanceFromHand(player, action.RecoveryInstanceId);
                var recovery = Card(instance);
                Require(recovery.Type == "recovery", "NOT_RECOVERY", "Choose a Recovery card.");
                connectionCost = recovery.ConnectionCost;
                player.DiscardPile.Add(RemoveFromHand(player, instance.InstanceId));
            }
            DiscardTable(state);
            AddConnection(state, -connectionCost);
            state.TurnDance.Stumbled = true;
            state.Phrase.Stumbled = true;
            Log(state, "dance", $"{RoleName(role)} stumbles and loses {connectionCost} Connection.", role);
            if (state.Shared.Connection == 0)
            {
                state.Status = GameStatus.Lost;
                state.Phase = TurnPhase.Terminal;
                state.TerminalReason = "Connection reached 0.";
                state.FinalScore = state.Shared.Style;
                state.Checkpoint = null;
                Log(state, "system", "The connection breaks. The dance is over.");
                return;
            }
            FinishDance(state, role);
        }

        private void BuyLesson(GameState state, GameAction action, PlayerState player, Role role)
        {
            Require(state.Phase == TurnPhase.Lesson, "WRONG_PHASE", "Lessons follow the dance.");
            Require(!state.TurnDance.BoughtLesson, "LESSON_LIMIT", "Only one lesson per turn.");
            var cost = Content.Rules.LessonCosts.For(action.Source);
            Require(player.Money >= cost, "NOT_ENOUGH_MONEY", $"This lesson costs ${cost}.");
            if (action.Source == "beginner")
            {
                Require(Content.Decks.BeginnerSupply.Contains(action.CardId), "NOT_IN_SUPPLY", "Card unavailable.");
            }
            else
            {
                Require(!state.Phrase.PrivateLessonTakenThisRound, "PRIVATE_LESSON_TAKEN", "Teacher unavailable.");
                if (action.Source == "advanced")
                    Require(state.SongIndex >= PhraseLength, "ADVANCED_CLOSED", "Advanced opens in Montuno.");
                var display = action.Source == "intermediate"
                    ? state.Market.IntermediateDisplay
                    : state.Market.AdvancedDisplay;
                var deck = action.Source == "intermediate"
                    ? state.Market.IntermediateDeck
                    : state.Market.AdvancedDeck;
                Require(display.Remove(action.CardId), "NOT_IN_MARKET", "Card unavailable.");
                Refill(deck, display, action.Source == "intermediate" ? 3 : 2);
                state.Phrase.PrivateLessonTakenThisRound = true;
            }
            player.Money -= cost;
            player.DiscardPile.Add(NewOwnedInstance(state, role, action.CardId));
            state.TurnDance.BoughtLesson = true;
            Log(state, "lesson", $"{RoleName(role)} learns {Content.Card(action.CardId).Name}.", role);
        }

        private void LearnFromPartner(GameState state, GameAction action, PlayerState player, Role role)
        {
            Require(state.Phase == TurnPhase.Lesson, "WRONG_PHASE", "Learn after dancing.");
            Require(!state.Phrase.LearnedBy.Get(role), "ALREADY_LEARNED", "Already learned this phrase.");
            var available = state.MoveHistory.Any(entry =>
                entry.Role == Other(role)
                && entry.Phrase == state.Phrase.Number
                && entry.CardId == action.CardId
                && entry.SongIndex < state.SongIndex
            );
            Require(available, "PARTNER_DID_NOT_PLAY", "Your partner has not played that Move.");
            player.DiscardPile.Add(NewOwnedInstance(state, role, action.CardId));
            state.Phrase.LearnedBy.Set(role, true);
            state.TurnDance.LearnedFromPartner = true;
            Log(state, "lesson", $"{RoleName(role)} learns {Content.Card(action.CardId).Name} from their partner.", role);
        }

        private void Freshen(GameState state, GameAction action, PlayerState player, Role role)
        {
            Require(state.Phase == TurnPhase.Freshen, "WRONG_PHASE", "Freshen after lessons.");
            var ids = action.DiscardInstanceIds ?? new List<string>();
            Require(ids.Distinct().Count() == ids.Count, "DUPLICATE_DISCARD", "Choose each card once.");
            foreach (var id in ids) InstanceFromHand(player, id);
            foreach (var id in ids) player.DiscardPile.Add(RemoveFromHand(player, id));
            DrawToHand(state, role);
            state.Signal = null;
            EndPhraseOrTurn(state, role);
        }

        private void StartTurn(GameState state, Role role)
        {
            state.ActiveRole = role;
            state.Phase = TurnPhase.Dance;
            state.SongIndex++;
            var song = Content.Song.Cards[state.SongIndex];
            state.CurrentSongId = song.Id;
            state.Player(role).Money += Content.Rules.IncomePerTurn;
            state.TurnDance = new TurnDance();
            state.Signal = null;
            if (role == Role.Lead) state.Phrase.PrivateLessonTakenThisRound = false;
            if (state.SongIndex == PhraseLength)
            {
                state.Market.AdvancedDisplay.AddRange(Take(state.Market.AdvancedDeck, 2));
                Log(state, "system", "The montuno begins. Advanced lessons are open.");
            }
            Log(state, "song", $"{song.Number} · {song.Section} · {song.Title}: {song.Description}", role);
            state.Checkpoint = SnapshotCheckpoint(state, state.Sequence + 1);
        }

        private void RecordMove(
            GameState state,
            Role role,
            CardInstance instance,
            string fromPosition,
            CardDefinition move
        )
        {
            DiscardMoveLayer(state);
            state.Table.Move = new TableMove { Card = instance, DancedFrom = fromPosition };
            state.Shared.Style += move.Style;
            state.TurnDance.MoveCardId = move.Id;
            state.TurnDance.MoveStyle = move.Style;
            state.TurnDance.FromPosition = fromPosition;
            state.TurnDance.CardsPlayed++;
            state.TurnDance.CanTransition = true;
            if (!state.Phrase.PositionsDancedFrom.Contains(fromPosition))
                state.Phrase.PositionsDancedFrom.Add(fromPosition);
            state.MoveHistory.Add(new MoveHistoryEntry
            {
                CardId = move.Id,
                Role = role,
                Phrase = state.Phrase.Number,
                SongIndex = state.SongIndex,
                FromPosition = fromPosition,
            });
            Log(state, "dance", $"{RoleName(role)} danced {move.Name} for {move.Style} Style.", role);
        }

        private void FinishDance(GameState state, Role role)
        {
            ApplySongBonus(state, role);
            state.TurnDance.CanTransition = false;
            state.Phase = TurnPhase.Lesson;
        }

        private void ApplySongBonus(GameState state, Role role)
        {
            var song = Content.Song.Cards[state.SongIndex];
            var branch = song.Bonuses.FirstOrDefault(bonus => BonusConditionMet(bonus.Condition, state, role));
            if (branch == null) return;
            state.Shared.Style += branch.Effect.Style;
            AddConnection(state, branch.Effect.Connection);
            state.TurnDance.BonusStyle = branch.Effect.Style;
            state.TurnDance.BonusConnection = branch.Effect.Connection;
            var rewards = new List<string>();
            if (branch.Effect.Style > 0) rewards.Add($"+{branch.Effect.Style} Style");
            if (branch.Effect.Connection > 0) rewards.Add($"+{branch.Effect.Connection} Connection");
            Log(state, "score", $"{song.Title} lands: {string.Join(" and ", rewards)}.", role);
        }

        private bool BonusConditionMet(BonusCondition condition, GameState state, Role role)
        {
            var turn = state.TurnDance;
            switch (condition.Op)
            {
                case "moveStyleAtMost":
                    return turn.MoveStyle.HasValue && turn.MoveStyle.Value <= condition.Value;
                case "moveStyleAtLeast":
                    return turn.MoveStyle.HasValue && turn.MoveStyle.Value >= condition.Value;
                case "moveFrom":
                    return turn.FromPosition != null && condition.Positions.Contains(turn.FromPosition);
                case "flourishPlayed":
                    return turn.Flourished;
                case "posePlayed":
                    return turn.PosePlayed;
                case "noPositionPlayed":
                    return turn.PositionsPlayed == 0;
                case "samePositionAsPreviousMove":
                    return turn.FromPosition != null
                        && state.MoveHistory.LastOrDefault(entry => entry.SongIndex < state.SongIndex)?.FromPosition
                            == turn.FromPosition;
                case "endsInPosition":
                    return state.Table.Position != null && PositionFor(state.Table.Position) == condition.Position;
                case "positionChanged":
                    return turn.ChangedPosition;
                case "partnerPlayedMoveGame":
                    return turn.MoveCardId != null
                        && state.MoveHistory.Any(entry =>
                            entry.Role == Other(role)
                            && entry.CardId == turn.MoveCardId
                            && entry.SongIndex < state.SongIndex
                        );
                case "partnerPlayedMovePhrase":
                    return turn.MoveCardId != null
                        && state.MoveHistory.Any(entry =>
                            entry.Role == Other(role)
                            && entry.CardId == turn.MoveCardId
                            && entry.Phrase == state.Phrase.Number
                            && entry.SongIndex < state.SongIndex
                        );
                case "cardsPlayedAtLeast":
                    return turn.CardsPlayed >= condition.Value;
                default:
                    return false;
            }
        }

        private void EndPhraseOrTurn(GameState state, Role role)
        {
            var phraseEnd = (state.SongIndex + 1) % PhraseLength == 0;
            if (phraseEnd) ScorePhrase(state);
            if (state.SongIndex == Content.Song.Cards.Count - 1)
            {
                FinishGame(state);
                return;
            }
            if (phraseEnd) state.Phrase = new PhraseStats { Number = 2 };
            StartTurn(state, Other(role));
        }

        private void ScorePhrase(GameState state)
        {
            var rewards = new List<string>();
            if (!state.Phrase.Stumbled)
            {
                state.Shared.Style += Content.Rules.PhraseBonuses.Clean;
                rewards.Add($"clean +{Content.Rules.PhraseBonuses.Clean}");
            }
            var extraPositions = Math.Max(0, state.Phrase.PositionsDancedFrom.Count - 1);
            if (extraPositions > 0)
            {
                var value = extraPositions * Content.Rules.PhraseBonuses.VarietyPerExtraPosition;
                state.Shared.Style += value;
                rewards.Add($"variety +{value}");
            }
            if (state.Phrase.FlourishedBy.Lead && state.Phrase.FlourishedBy.Follow)
            {
                state.Shared.Style += Content.Rules.PhraseBonuses.SharedFlair;
                rewards.Add($"shared flair +{Content.Rules.PhraseBonuses.SharedFlair}");
            }
            if (state.Phrase.PoseOnFinalCount)
            {
                state.Shared.Style += Content.Rules.PhraseBonuses.PoseFinish;
                rewards.Add($"pose finish +{Content.Rules.PhraseBonuses.PoseFinish}");
            }
            Log(
                state,
                "score",
                $"Phrase {state.Phrase.Number}: {(rewards.Count > 0 ? string.Join(", ", rewards) : "no phrase bonuses")}."
            );
            DiscardTable(state);
        }

        private void FinishGame(GameState state)
        {
            state.Status = GameStatus.Completed;
            state.Phase = TurnPhase.Terminal;
            state.CurrentSongId = null;
            state.FinalScore = state.Shared.Style + state.Shared.Connection;
            state.Rating = Content.Rules.Ratings
                .OrderByDescending(rating => rating.Minimum)
                .First(rating => state.FinalScore.Value >= rating.Minimum)
                .Name;
            state.TerminalReason = "The final 8-count is complete.";
            state.Checkpoint = null;
            Log(state, "system", $"The song ends at {state.FinalScore} — {state.Rating}.");
        }

        private void DrawToHand(GameState state, Role role)
        {
            var player = state.Player(role);
            while (player.Hand.Count < Content.Rules.HandSize)
            {
                if (player.DrawPile.Count == 0)
                {
                    if (player.DiscardPile.Count == 0) break;
                    player.DrawPile = DeterministicRng.Shuffle(player.DiscardPile, ref state.RngState);
                    player.DiscardPile = new List<CardInstance>();
                }
                player.Hand.Add(player.DrawPile[0]);
                player.DrawPile.RemoveAt(0);
            }
        }

        private bool CanMulligan(PlayerState player)
        {
            var positions = player.Hand.Where(entry => Card(entry).Type == "position");
            var moves = player.Hand.Where(entry => Card(entry).Type == "move").ToList();
            return !positions.Any(position => moves.Any(move => Card(move).MatchesPosition(Card(position).Position)));
        }

        private void RestoreCheckpoint(GameState state)
        {
            Require(state.Checkpoint != null, "NOTHING_TO_UNDO", "Nothing to undo.");
            var checkpoint = Clone(state.Checkpoint);
            state.Players = checkpoint.Players;
            state.Table = checkpoint.Table;
            state.Shared = checkpoint.Shared;
            state.Market = checkpoint.Market;
            state.Phrase = checkpoint.Phrase;
            state.MoveHistory = checkpoint.MoveHistory;
            state.RngState = checkpoint.RngState;
            state.NextInstance = checkpoint.NextInstance;
            state.TurnDance = checkpoint.TurnDance;
            state.Signal = null;
            state.Phase = TurnPhase.Dance;
            state.Checkpoint = SnapshotCheckpoint(state, state.Sequence + 1);
        }

        private TurnCheckpoint SnapshotCheckpoint(GameState state, int sequence)
        {
            return Clone(new TurnCheckpoint
            {
                Sequence = sequence,
                Players = state.Players,
                Table = state.Table,
                Shared = state.Shared,
                Market = state.Market,
                Phrase = state.Phrase,
                MoveHistory = state.MoveHistory,
                RngState = state.RngState,
                NextInstance = state.NextInstance,
                TurnDance = state.TurnDance,
                Signal = state.Signal,
            });
        }

        private CardDefinition Card(CardInstance instance) => Content.Card(instance.CardId);

        private string PositionFor(CardInstance instance)
        {
            var definition = Card(instance);
            Require(definition.Type == "position", "NOT_A_POSITION", "Choose a Position card.");
            return definition.Position;
        }

        private CardInstance InstanceFromHand(PlayerState player, string instanceId)
        {
            var result = player.Hand.FirstOrDefault(entry => entry.InstanceId == instanceId);
            Require(result != null, "CARD_NOT_IN_HAND", "That card is not in your hand.");
            return result;
        }

        private CardInstance RemoveFromHand(PlayerState player, string instanceId)
        {
            var instance = InstanceFromHand(player, instanceId);
            player.Hand.Remove(instance);
            return instance;
        }

        private void DiscardTable(GameState state)
        {
            if (state.Table.Position != null)
                state.Player(state.Table.Position.Owner).DiscardPile.Add(state.Table.Position);
            DiscardMoveLayer(state);
            state.Table = new DanceTable();
        }

        private void DiscardMoveLayer(GameState state)
        {
            if (state.Table.Move != null)
                state.Player(state.Table.Move.Card.Owner).DiscardPile.Add(state.Table.Move.Card);
            if (state.Table.Flourish != null)
                state.Player(state.Table.Flourish.Owner).DiscardPile.Add(state.Table.Flourish);
            state.Table.Move = null;
            state.Table.Flourish = null;
        }

        private void AddConnection(GameState state, int amount)
        {
            state.Shared.Connection = Math.Max(
                0,
                Math.Min(Content.Rules.MaximumConnection, state.Shared.Connection + amount)
            );
        }

        private static List<string> Expand(IEnumerable<CountedCard> entries)
        {
            return entries.SelectMany(entry => Enumerable.Repeat(entry.CardId, entry.Count)).ToList();
        }

        private static List<T> Take<T>(List<T> deck, int amount)
        {
            var count = Math.Min(amount, deck.Count);
            var result = deck.GetRange(0, count);
            deck.RemoveRange(0, count);
            return result;
        }

        private static void Refill<T>(List<T> deck, List<T> display, int target)
        {
            display.AddRange(Take(deck, Math.Max(0, target - display.Count)));
        }

        private static T Clone<T>(T value)
        {
            return JsonConvert.DeserializeObject<T>(JsonConvert.SerializeObject(value));
        }

        private static CardInstance NewOwnedInstance(GameState state, Role role, string cardId)
        {
            return new CardInstance
            {
                InstanceId = $"{role.ToString().ToLowerInvariant()}-{state.NextInstance++}",
                CardId = cardId,
                Owner = role,
            };
        }

        private static GameAction Action(GameActionType type, Role role)
        {
            return new GameAction { Type = type, Role = role };
        }

        private static GameAction BuyAction(Role role, string source, string cardId)
        {
            return new GameAction
            {
                Type = GameActionType.BuyLesson,
                Role = role,
                Source = source,
                CardId = cardId,
            };
        }

        private static Role Other(Role role) => role == Role.Lead ? Role.Follow : Role.Lead;
        private static string RoleName(Role role) => role == Role.Lead ? "Lead" : "Follow";
        private int PhraseLength => Content.Song.Cards.Count / 2;

        private static void Log(GameState state, string kind, string message, Role? role = null)
        {
            state.Log.Add(new LogEntry
            {
                Sequence = state.Sequence + 1,
                Role = role,
                Kind = kind,
                Message = message,
            });
        }

        private static void Require(bool condition, string code, string message)
        {
            if (!condition) throw new RuleException(code, message);
        }
    }
}
