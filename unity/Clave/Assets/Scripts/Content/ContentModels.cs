using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Clave.Content
{
    public sealed class ContentSet
    {
        public int Version { get; private set; }
        public RulesDefinition Rules { get; private set; }
        public IReadOnlyList<CardDefinition> Cards { get; private set; }
        public DeckDefinitions Decks { get; private set; }
        public SongDefinition Song { get; private set; }
        public IReadOnlyDictionary<string, CardDefinition> CardsById { get; private set; }

        public static ContentSet Parse(string cardsJson, string songJson)
        {
            var catalog = JsonConvert.DeserializeObject<CardCatalogFile>(cardsJson)
                ?? throw new InvalidOperationException("cards.json is empty or invalid.");
            var song = JsonConvert.DeserializeObject<SongDefinition>(songJson)
                ?? throw new InvalidOperationException("song-lloraras.json is empty or invalid.");
            var content = new ContentSet
            {
                Version = catalog.Version,
                Rules = catalog.Rules,
                Cards = catalog.Cards,
                Decks = catalog.Decks,
                Song = song,
                CardsById = catalog.Cards.ToDictionary(card => card.Id, StringComparer.Ordinal),
            };
            content.Validate();
            return content;
        }

        public CardDefinition Card(string id)
        {
            if (!CardsById.TryGetValue(id, out var card))
                throw new InvalidOperationException($"Unknown card id {id}.");
            return card;
        }

        private void Validate()
        {
            if (Version != 1) throw new InvalidOperationException("Unity Clave supports content version 1.");
            if (Rules == null || Decks == null || Song == null)
                throw new InvalidOperationException("Content is missing rules, decks, or song data.");
            if (Cards == null || Cards.Count == 0)
                throw new InvalidOperationException("Content has no dance cards.");
            if (Song.Cards == null || Song.Cards.Count != 16)
                throw new InvalidOperationException("The v1 song must contain 16 cards.");

            var cardPattern = new Regex("^(pos|mov|flo|rec)_[0-9]{3}$", RegexOptions.CultureInvariant);
            var songPattern = new Regex("^song_[0-9]{3}$", RegexOptions.CultureInvariant);
            if (Cards.Any(card => !cardPattern.IsMatch(card.Id)))
                throw new InvalidOperationException("A dance card id does not match the v1 id format.");
            if (Song.Cards.Any(card => !songPattern.IsMatch(card.Id)))
                throw new InvalidOperationException("A song card id does not match the v1 id format.");
            if (CardsById.Count != Cards.Count)
                throw new InvalidOperationException("Dance card ids must be unique.");
            if (Song.Cards.Select(card => card.Id).Distinct().Count() != Song.Cards.Count)
                throw new InvalidOperationException("Song card ids must be unique.");

            foreach (var id in Decks.AllReferencedCardIds()) Card(id);
        }
    }

    internal sealed class CardCatalogFile
    {
        [JsonProperty("version")] public int Version { get; set; }
        [JsonProperty("rules")] public RulesDefinition Rules { get; set; }
        [JsonProperty("cards")] public List<CardDefinition> Cards { get; set; }
        [JsonProperty("decks")] public DeckDefinitions Decks { get; set; }
    }

    public sealed class RulesDefinition
    {
        [JsonProperty("initialConnection")] public int InitialConnection { get; set; }
        [JsonProperty("maximumConnection")] public int MaximumConnection { get; set; }
        [JsonProperty("initialStyle")] public int InitialStyle { get; set; }
        [JsonProperty("startingMoney")] public int StartingMoney { get; set; }
        [JsonProperty("incomePerTurn")] public int IncomePerTurn { get; set; }
        [JsonProperty("handSize")] public int HandSize { get; set; }
        [JsonProperty("danceLimits")] public DanceLimits DanceLimits { get; set; }
        [JsonProperty("stumble")] public StumbleRules Stumble { get; set; }
        [JsonProperty("lessonCosts")] public LessonCosts LessonCosts { get; set; }
        [JsonProperty("phraseBonuses")] public PhraseBonuses PhraseBonuses { get; set; }
        [JsonProperty("ratings")] public List<RatingDefinition> Ratings { get; set; }
    }

    public sealed class DanceLimits
    {
        [JsonProperty("positions")] public int Positions { get; set; }
        [JsonProperty("moves")] public int Moves { get; set; }
        [JsonProperty("flourishes")] public int Flourishes { get; set; }
    }

    public sealed class StumbleRules
    {
        [JsonProperty("defaultConnectionCost")] public int DefaultConnectionCost { get; set; }
    }

    public sealed class LessonCosts
    {
        [JsonProperty("beginner")] public int Beginner { get; set; }
        [JsonProperty("intermediate")] public int Intermediate { get; set; }
        [JsonProperty("advanced")] public int Advanced { get; set; }

        public int For(string source)
        {
            return source switch
            {
                "beginner" => Beginner,
                "intermediate" => Intermediate,
                "advanced" => Advanced,
                _ => throw new ArgumentOutOfRangeException(nameof(source), source, null),
            };
        }
    }

    public sealed class PhraseBonuses
    {
        [JsonProperty("clean")] public int Clean { get; set; }
        [JsonProperty("varietyPerExtraPosition")] public int VarietyPerExtraPosition { get; set; }
        [JsonProperty("sharedFlair")] public int SharedFlair { get; set; }
        [JsonProperty("poseFinish")] public int PoseFinish { get; set; }
    }

    public sealed class RatingDefinition
    {
        [JsonProperty("minimum")] public int Minimum { get; set; }
        [JsonProperty("name")] public string Name { get; set; }
        [JsonProperty("description")] public string Description { get; set; }
    }

    public sealed class CardDefinition
    {
        [JsonProperty("id")] public string Id { get; set; }
        [JsonProperty("name")] public string Name { get; set; }
        [JsonProperty("tier")] public string Tier { get; set; }
        [JsonProperty("type")] public string Type { get; set; }
        [JsonProperty("position")] public string Position { get; set; }
        [JsonProperty("positions")] public JToken PositionsRaw { get; set; }
        [JsonProperty("style")] public int Style { get; set; }
        [JsonProperty("pose")] public bool Pose { get; set; }
        [JsonProperty("connectionCost")] public int ConnectionCost { get; set; }

        [JsonIgnore]
        public IReadOnlyList<string> Positions
        {
            get
            {
                if (PositionsRaw == null) return Array.Empty<string>();
                if (PositionsRaw.Type == JTokenType.String && PositionsRaw.Value<string>() == "any")
                    return Array.Empty<string>();
                return PositionsRaw.ToObject<List<string>>() ?? new List<string>();
            }
        }

        public bool MatchesPosition(string position)
        {
            return PositionsRaw?.Type == JTokenType.String && PositionsRaw.Value<string>() == "any"
                || Positions.Contains(position);
        }
    }

    public sealed class CountedCard
    {
        [JsonProperty("cardId")] public string CardId { get; set; }
        [JsonProperty("count")] public int Count { get; set; }
    }

    public sealed class FullDecks
    {
        [JsonProperty("lead")] public List<CountedCard> Lead { get; set; }
        [JsonProperty("follow")] public List<CountedCard> Follow { get; set; }
    }

    public sealed class DeckDefinitions
    {
        [JsonProperty("starter")] public List<CountedCard> Starter { get; set; }
        [JsonProperty("beginnerSupply")] public List<string> BeginnerSupply { get; set; }
        [JsonProperty("intermediate")] public List<CountedCard> Intermediate { get; set; }
        [JsonProperty("advanced")] public List<CountedCard> Advanced { get; set; }
        [JsonProperty("full")] public FullDecks Full { get; set; }

        public IEnumerable<string> AllReferencedCardIds()
        {
            return Starter.Select(card => card.CardId)
                .Concat(BeginnerSupply)
                .Concat(Intermediate.Select(card => card.CardId))
                .Concat(Advanced.Select(card => card.CardId))
                .Concat(Full.Lead.Select(card => card.CardId))
                .Concat(Full.Follow.Select(card => card.CardId));
        }
    }

    public sealed class SongDefinition
    {
        [JsonProperty("id")] public string Id { get; set; }
        [JsonProperty("title")] public string Title { get; set; }
        [JsonProperty("artist")] public string Artist { get; set; }
        [JsonProperty("cards")] public List<SongCardDefinition> Cards { get; set; }
    }

    public sealed class SongCardDefinition
    {
        [JsonProperty("id")] public string Id { get; set; }
        [JsonProperty("number")] public int Number { get; set; }
        [JsonProperty("section")] public string Section { get; set; }
        [JsonProperty("moment")] public string Moment { get; set; }
        [JsonProperty("title")] public string Title { get; set; }
        [JsonProperty("description")] public string Description { get; set; }
        [JsonProperty("bonuses")] public List<SongBonusDefinition> Bonuses { get; set; }
    }

    public sealed class SongBonusDefinition
    {
        [JsonProperty("condition")] public BonusCondition Condition { get; set; }
        [JsonProperty("effect")] public BonusEffect Effect { get; set; }
    }

    public sealed class BonusCondition
    {
        [JsonProperty("op")] public string Op { get; set; }
        [JsonProperty("value")] public int Value { get; set; }
        [JsonProperty("positions")] public List<string> Positions { get; set; }
        [JsonProperty("position")] public string Position { get; set; }
    }

    public sealed class BonusEffect
    {
        [JsonProperty("style")] public int Style { get; set; }
        [JsonProperty("connection")] public int Connection { get; set; }
    }
}
