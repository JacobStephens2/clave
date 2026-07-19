using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace Clave.Engine
{
    public enum Role
    {
        Lead,
        Follow,
    }

    public enum GameStatus
    {
        Setup,
        Playing,
        Completed,
        Lost,
    }

    public enum TurnPhase
    {
        Mulligan,
        Dance,
        Lesson,
        Freshen,
        Terminal,
    }

    public enum GameActionType
    {
        Mulligan,
        ConfirmHand,
        PlayOpen,
        PlayMove,
        Transition,
        PlayFlourish,
        EndDance,
        Stumble,
        BuyLesson,
        LearnFromPartner,
        EndLesson,
        Freshen,
        SignalCard,
        ClearSignal,
        UndoTurn,
    }

    [Serializable]
    public sealed class CardInstance
    {
        public string InstanceId;
        public string CardId;
        public Role Owner;
    }

    [Serializable]
    public sealed class PlayerState
    {
        public Role Role;
        public List<CardInstance> Hand = new();
        public List<CardInstance> DrawPile = new();
        public List<CardInstance> DiscardPile = new();
        public int Money;
        public bool MulliganUsed;
        public bool Ready;
    }

    [Serializable]
    public sealed class TableMove
    {
        public CardInstance Card;
        public string DancedFrom;
    }

    [Serializable]
    public sealed class DanceTable
    {
        public CardInstance Position;
        public TableMove Move;
        public CardInstance Flourish;
    }

    [Serializable]
    public sealed class TurnDance
    {
        public string MoveCardId;
        public int? MoveStyle;
        public string FromPosition;
        public int CardsPlayed;
        public int PositionsPlayed;
        public bool Flourished;
        public bool PosePlayed;
        public bool ChangedPosition;
        public bool Stumbled;
        public bool CanTransition;
        public bool BoughtLesson;
        public bool LearnedFromPartner;
        public int BonusStyle;
        public int BonusConnection;
    }

    [Serializable]
    public sealed class RoleFlags
    {
        public bool Lead;
        public bool Follow;

        public bool Get(Role role) => role == Role.Lead ? Lead : Follow;

        public void Set(Role role, bool value)
        {
            if (role == Role.Lead) Lead = value;
            else Follow = value;
        }
    }

    [Serializable]
    public sealed class PhraseStats
    {
        public int Number = 1;
        public bool Stumbled;
        public List<string> PositionsDancedFrom = new();
        public RoleFlags FlourishedBy = new();
        public bool PoseOnFinalCount;
        public RoleFlags LearnedBy = new();
        public bool PrivateLessonTakenThisRound;
    }

    [Serializable]
    public sealed class MoveHistoryEntry
    {
        public string CardId;
        public Role Role;
        public int Phrase;
        public int SongIndex;
        public string FromPosition;
    }

    [Serializable]
    public sealed class MarketState
    {
        public List<string> IntermediateDeck = new();
        public List<string> IntermediateDisplay = new();
        public List<string> AdvancedDeck = new();
        public List<string> AdvancedDisplay = new();
    }

    [Serializable]
    public sealed class SharedScore
    {
        public int Connection;
        public int Style;
    }

    [Serializable]
    public sealed class SignalState
    {
        public Role Role;
        public string InstanceId;
    }

    [Serializable]
    public sealed class LogEntry
    {
        public int Sequence;
        public Role? Role;
        public string Kind;
        public string Message;
    }

    [Serializable]
    public sealed class TurnCheckpoint
    {
        public int Sequence;
        public Dictionary<Role, PlayerState> Players;
        public DanceTable Table;
        public SharedScore Shared;
        public MarketState Market;
        public PhraseStats Phrase;
        public List<MoveHistoryEntry> MoveHistory;
        public uint RngState;
        public int NextInstance;
        public TurnDance TurnDance;
        public SignalState Signal;
    }

    [Serializable]
    public sealed class GameState
    {
        public const int EngineVersion = 1;

        public int Version = EngineVersion;
        public string GameId;
        public uint Seed;
        public uint RngState;
        public int NextInstance = 1;
        public int Sequence;
        public GameStatus Status;
        public string TerminalReason;
        public Role ActiveRole;
        public Role SetupRole;
        public TurnPhase Phase;
        public int SongIndex = -1;
        public string CurrentSongId;
        public Dictionary<Role, PlayerState> Players = new();
        public SharedScore Shared = new();
        public MarketState Market = new();
        public DanceTable Table = new();
        public PhraseStats Phrase = new();
        public List<MoveHistoryEntry> MoveHistory = new();
        public TurnDance TurnDance = new();
        public SignalState Signal;
        public List<LogEntry> Log = new();
        public TurnCheckpoint Checkpoint;
        public int? FinalScore;
        public string Rating;

        public PlayerState Player(Role role) => Players[role];
    }

    [Serializable]
    public sealed class GameAction
    {
        public GameActionType Type;
        public Role Role;
        public string PositionInstanceId;
        public string MoveInstanceId;
        public string FlourishInstanceId;
        public string RecoveryInstanceId;
        public string InstanceId;
        public string Source;
        public string CardId;
        public List<string> DiscardInstanceIds = new();

        [JsonIgnore] public string StableKey => $"{Type}:{PositionInstanceId}:{MoveInstanceId}:{FlourishInstanceId}:{RecoveryInstanceId}:{InstanceId}:{Source}:{CardId}";
    }

    public readonly struct ApplyResult
    {
        public readonly bool Ok;
        public readonly string Code;
        public readonly string Message;

        private ApplyResult(bool ok, string code, string message)
        {
            Ok = ok;
            Code = code;
            Message = message;
        }

        public static ApplyResult Success() => new(true, null, null);
        public static ApplyResult Failure(string code, string message) => new(false, code, message);
    }
}
