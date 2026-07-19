using System;
using System.Collections.Generic;
using System.Linq;
using Clave.Content;
using Clave.Engine;
using UnityEngine;
using UnityEngine.UIElements;

namespace Clave.Presentation
{
    public sealed class ClaveApp : MonoBehaviour
    {
        private ContentSet _content;
        private ClaveEngine _engine;
        private UIDocument _document;
        private Role _visibleRole;
        private bool _awaitingPass;
        private bool _signalPeek;
        private CardDefinition _inspectedCard;
        private string _error;
        private string _seedText = "20260719";
        private bool _styleApplied;
        private VisualElement _floorDropZone;
        private VisualElement _dragSource;
        private VisualElement _dragPreview;
        private CardInstance _draggedInstance;
        private CardDefinition _draggedDefinition;
        private Vector2 _dragStart;
        private int _dragPointerId = -1;
        private bool _dragActive;
        private string _suppressCardClickInstanceId;
        private string _pendingOpenPositionInstanceId;
        private readonly HashSet<string> _selectedDiscards = new(StringComparer.Ordinal);
        private const float DragThreshold = 8f;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            if (FindAnyObjectByType<ClaveApp>() != null) return;
            var host = new GameObject("Clave macOS App");
            DontDestroyOnLoad(host);
            host.AddComponent<ClaveApp>();
        }

        private void Start()
        {
            try
            {
                _content = ContentLoader.Load();
                _document = gameObject.AddComponent<UIDocument>();
                _document.panelSettings = LoadPanelSettings();
                RenderHome();
            }
            catch (Exception exception)
            {
                Debug.LogException(exception);
                RenderFatal(exception.Message);
            }
        }

        private VisualElement Root()
        {
            ResetCardDrag();
            _suppressCardClickInstanceId = null;
            var root = _document.rootVisualElement;
            root.Clear();
            var styleSheet = Resources.Load<StyleSheet>("Clave");
            if (styleSheet != null && !_styleApplied)
            {
                root.styleSheets.Add(styleSheet);
                _styleApplied = true;
            }
            root.AddToClassList("root");
            return root;
        }

        private static PanelSettings LoadPanelSettings()
        {
            var settings = Resources.Load<PanelSettings>("ClavePanelSettings");
            if (settings == null)
                throw new InvalidOperationException("Missing Assets/Resources/ClavePanelSettings.asset. Run Clave > Build macOS App from the Unity editor.");
            return settings;
        }

        private void RenderHome()
        {
            var root = Root();
            var page = Element("home");
            root.Add(page);

            page.Add(Text("A PARTNER DANCE GAME", "eyebrow"));
            page.Add(Text("CLAVE", "home-title"));
            page.Add(Text("Dance Llorarás together — one 8-count at a time.", "home-subtitle"));

            var card = Element("home-card");
            card.Add(Text("Pass & play on macOS", "section-title"));
            card.Add(Text("Lead and Follow share one screen, with room for the floor, both scores, lessons, and a readable hand.", "body-copy"));
            var seed = new TextField("Seed") { value = _seedText };
            seed.AddToClassList("seed-field");
            seed.RegisterValueChangedCallback(change => _seedText = change.newValue);
            card.Add(seed);
            card.Add(ActionButton("Start a new dance", StartNewGame, "primary"));
            if (GamePersistence.HasSave)
            {
                card.Add(ActionButton("Resume saved dance", ResumeGame, "secondary"));
                card.Add(ActionButton("Discard saved dance", DeleteSave, "text-action"));
            }
            page.Add(card);
            page.Add(Text("Designed for a 1440 × 900 or larger Mac window · deterministic C# engine · local save", "home-footnote"));
        }

        private void StartNewGame()
        {
            if (!uint.TryParse(_seedText, out var seed))
            {
                _error = "Use a whole number from 0 to 4,294,967,295 for the seed.";
                RenderHomeError();
                return;
            }
            _engine = new ClaveEngine(_content, seed);
            _visibleRole = Role.Lead;
            _awaitingPass = true;
            _error = null;
            _pendingOpenPositionInstanceId = null;
            _selectedDiscards.Clear();
            GamePersistence.Save(_engine);
            RenderGame();
        }

        private void ResumeGame()
        {
            try
            {
                _engine = GamePersistence.Load(_content);
                _visibleRole = ViewerRole();
                _awaitingPass = _engine.State.Status is GameStatus.Setup or GameStatus.Playing;
                _error = null;
                _pendingOpenPositionInstanceId = null;
                _selectedDiscards.Clear();
                RenderGame();
            }
            catch (Exception exception)
            {
                _error = exception.Message;
                RenderHomeError();
            }
        }

        private void DeleteSave()
        {
            GamePersistence.Delete();
            RenderHome();
        }

        private void RenderHomeError()
        {
            RenderHome();
            if (!string.IsNullOrEmpty(_error)) _document.rootVisualElement.Add(Text(_error, "toast-error"));
        }

        private void RenderGame()
        {
            var state = _engine.State;
            ValidatePendingOpening(state);
            var root = Root();
            var shell = Element("game-shell");
            root.Add(shell);
            shell.Add(BuildHeader(state));

            if (state.Status is GameStatus.Completed or GameStatus.Lost)
            {
                shell.Add(BuildTerminal(state));
            }
            else
            {
                shell.Add(BuildHud(state));
                var workspace = Element("workspace");
                workspace.Add(BuildMainTable(state));
                workspace.Add(BuildSidebar(state));
                shell.Add(workspace);
            }

            if (!string.IsNullOrEmpty(_error)) root.Add(Text(_error, "toast-error"));
            if (_awaitingPass && state.Status is GameStatus.Setup or GameStatus.Playing)
                root.Add(BuildPassOverlay(state));
            if (_signalPeek && state.Signal != null) root.Add(BuildSignalOverlay(state));
            if (_inspectedCard != null) root.Add(BuildCardInspector(_inspectedCard));
        }

        private VisualElement BuildHeader(GameState state)
        {
            var header = Element("header");
            header.Add(ActionButton("CLAVE", BackHome, "brand-button"));
            header.Add(Text("MACOS HOT-SEAT", "mode-label"));
            header.Add(Text($"SEED {state.Seed}", "seed-label"));
            return header;
        }

        private VisualElement BuildHud(GameState state)
        {
            var hud = Element("hud");
            hud.Add(Stat("CONNECTION", $"{state.Shared.Connection}/{_content.Rules.MaximumConnection}"));
            hud.Add(Stat("STYLE", state.Shared.Style.ToString()));
            hud.Add(Stat("YOUR PRACTICE", $"${state.Player(_visibleRole).Money}"));
            var phraseCount = state.SongIndex < 0 ? 0 : state.SongIndex % 8 + 1;
            hud.Add(Stat($"PHRASE {state.Phrase.Number}", $"{phraseCount}/8"));
            hud.Add(Stat("ROLE", RoleName(_visibleRole).ToUpperInvariant()));
            return hud;
        }

        private VisualElement BuildMainTable(GameState state)
        {
            var main = Element("main-table");
            main.Add(BuildSong(state));
            main.Add(BuildDanceFloor(state));
            main.Add(BuildActions(state));
            main.Add(BuildHand(state));
            return main;
        }

        private VisualElement BuildSong(GameState state)
        {
            var song = Element("song-banner");
            if (state.SongIndex < 0)
            {
                song.Add(Text("◇", "song-count"));
                var opening = Element("song-copy");
                opening.Add(Text("SETUP", "eyebrow"));
                opening.Add(Text("Opening hands", "song-title"));
                opening.Add(Text("Find a Position with a matching Move.", "song-description"));
                song.Add(opening);
                return song;
            }
            var moment = _content.Song.Cards[state.SongIndex];
            song.Add(Text(moment.Number.ToString("00"), "song-count"));
            var copy = Element("song-copy");
            copy.Add(Text($"{moment.Section.ToUpperInvariant()} · {moment.Moment.ToUpperInvariant()}", "eyebrow"));
            copy.Add(Text(moment.Title, "song-title"));
            copy.Add(Text(moment.Description, "song-description"));
            song.Add(copy);
            return song;
        }

        private VisualElement BuildDanceFloor(GameState state)
        {
            var floor = Element("dance-floor");
            _floorDropZone = floor;
            var pendingPosition = PendingOpenPosition(state);
            var acceptsDrop = state.Player(_visibleRole).Hand.Any(instance => DropActionsFor(instance.InstanceId).Count > 0);
            if (acceptsDrop) floor.AddToClassList("accepts-card-drop");
            var heading = Element("section-heading");
            heading.Add(Text("ON THE FLOOR", "eyebrow"));
            heading.Add(Text(
                acceptsDrop
                    ? pendingPosition == null ? "Drag a highlighted Position here" : "Now drag a matching Move here"
                    : state.ActiveRole == _visibleRole ? "Your 8-count" : $"{RoleName(state.ActiveRole)}'s 8-count",
                acceptsDrop ? "drop-hint" : "muted"
            ));
            floor.Add(heading);
            var cards = Element("table-cards");
            cards.Add(TableSlot("POSITION", state.Table.Position ?? pendingPosition, pendingPosition != null));
            cards.Add(Text("→", "connector"));
            cards.Add(TableSlot("LAST MOVE", state.Table.Move?.Card));
            cards.Add(Text("✦", "connector"));
            cards.Add(TableSlot("FLOURISH", state.Table.Flourish));
            floor.Add(cards);
            return floor;
        }

        private VisualElement BuildActions(GameState state)
        {
            var area = Element("actions-area");
            var pendingPosition = PendingOpenPosition(state);
            var openingDrag = state.Status == GameStatus.Playing
                && state.Phase == TurnPhase.Dance
                && state.Table.Position == null;
            area.Add(Text(
                pendingPosition != null
                    ? "OPENING · DRAG A MATCHING MOVE"
                    : openingDrag ? "OPENING · DRAG A POSITION" : ActionHeading(state),
                "section-title"
            ));
            var actions = Element("action-buttons");
            if (pendingPosition != null)
            {
                actions.Add(ActionButton("Return Position to hand", CancelStagedPosition, "secondary"));
            }
            else
            {
                foreach (var action in _engine.LegalActions(_visibleRole).Where(ShowInActionStrip))
                {
                    var captured = action;
                    actions.Add(ActionButton(ActionLabel(captured), () => ApplyAction(captured), ActionClass(captured)));
                }
            }
            area.Add(actions);
            return area;
        }

        private VisualElement BuildHand(GameState state)
        {
            var zone = Element("hand-zone");
            var player = state.Player(_visibleRole);
            var pendingPosition = PendingOpenPosition(state);
            var visibleHand = player.Hand
                .Where(instance => instance.InstanceId != _pendingOpenPositionInstanceId)
                .ToList();
            var heading = Element("section-heading");
            heading.Add(Text(
                $"{RoleName(_visibleRole).ToUpperInvariant()} HAND · {visibleHand.Count} CARDS"
                    + (pendingPosition == null ? "" : " · 1 POSITION STAGED"),
                "eyebrow"
            ));
            heading.Add(Text(
                pendingPosition == null
                    ? $"Deck {player.DrawPile.Count} · Discard {player.DiscardPile.Count}"
                    : "Choose a highlighted matching Move",
                pendingPosition == null ? "muted" : "drop-hint"
            ));
            zone.Add(heading);

            var row = new ScrollView(ScrollViewMode.Horizontal);
            row.AddToClassList("hand-scroll");
            foreach (var instance in visibleHand)
            {
                var definition = _content.Card(instance.CardId);
                row.Add(BuildCard(definition, instance, state.Phase == TurnPhase.Freshen));
            }
            zone.Add(row);
            return zone;
        }

        private VisualElement BuildSidebar(GameState state)
        {
            var sidebar = Element("sidebar");
            sidebar.Add(BuildLessons(state));
            sidebar.Add(BuildLog(state));
            return sidebar;
        }

        private VisualElement BuildLessons(GameState state)
        {
            var lessons = Element("panel");
            lessons.Add(Text("LESSONS", "section-title"));
            lessons.Add(Text(state.Phrase.PrivateLessonTakenThisRound ? "Private teacher booked" : "Private teacher available", "muted"));
            if (state.Phase != TurnPhase.Lesson)
            {
                lessons.Add(Text("Available after your dance step.", "body-copy"));
                return lessons;
            }

            var buys = _engine.LegalActions(_visibleRole).Where(action => action.Type == GameActionType.BuyLesson).ToList();
            AddMarketGroup(lessons, "BEGINNER · $1", _content.Decks.BeginnerSupply, buys);
            AddMarketGroup(lessons, "INTERMEDIATE · $2", state.Market.IntermediateDisplay, buys);
            if (state.SongIndex >= 8) AddMarketGroup(lessons, "ADVANCED · $3", state.Market.AdvancedDisplay, buys);

            var learning = _engine.LegalActions(_visibleRole).Where(action => action.Type == GameActionType.LearnFromPartner);
            foreach (var action in learning)
            {
                var captured = action;
                lessons.Add(ActionButton($"Learn { _content.Card(action.CardId).Name } from partner", () => ApplyAction(captured), "market-action"));
            }
            return lessons;
        }

        private void AddMarketGroup(
            VisualElement parent,
            string title,
            IEnumerable<string> cardIds,
            IReadOnlyCollection<GameAction> buys
        )
        {
            parent.Add(Text(title, "market-heading"));
            foreach (var cardId in cardIds.Distinct())
            {
                var definition = _content.Card(cardId);
                var row = Element("market-row");
                row.Add(ActionButton(definition.Name, () => Inspect(definition), "market-card"));
                var action = buys.FirstOrDefault(candidate => candidate.CardId == cardId);
                if (action != null)
                {
                    var captured = action;
                    row.Add(ActionButton("Learn", () => ApplyAction(captured), "small-primary"));
                }
                row.AddToClassList($"type-{definition.Type}");
                parent.Add(row);
            }
        }

        private VisualElement BuildLog(GameState state)
        {
            var panel = Element("panel");
            panel.Add(Text("DANCE LOG", "section-title"));
            var scroll = new ScrollView(ScrollViewMode.Vertical);
            scroll.AddToClassList("log-scroll");
            foreach (var entry in state.Log.Skip(Math.Max(0, state.Log.Count - 12)).Reverse())
            {
                var row = Element("log-entry");
                row.Add(Text(entry.Sequence == 0 ? "·" : entry.Sequence.ToString(), "log-sequence"));
                row.Add(Text(entry.Message, "log-copy"));
                scroll.Add(row);
            }
            panel.Add(scroll);
            return panel;
        }

        private VisualElement BuildCard(
            CardDefinition definition,
            CardInstance instance = null,
            bool showDiscardToggle = false
        )
        {
            var card = Element("dance-card");
            var draggable = instance != null && DropActionsFor(instance.InstanceId).Count > 0;
            card.tooltip = draggable ? "Drag to the floor to play · click to view larger" : "Click to view larger";
            card.RegisterCallback<ClickEvent>(evt =>
            {
                var target = evt.target as VisualElement;
                if (instance != null && _suppressCardClickInstanceId == instance.InstanceId)
                {
                    _suppressCardClickInstanceId = null;
                    evt.StopPropagation();
                    return;
                }
                if (IsInteractiveControl(target)) return;
                Inspect(definition);
            });
            card.AddToClassList($"type-{definition.Type}");
            card.AddToClassList($"tier-{definition.Tier.ToLowerInvariant()}");
            if (draggable)
            {
                card.AddToClassList("playable-card");
                ConfigureCardDrag(card, definition, instance);
            }
            card.Add(Text($"{definition.Type.ToUpperInvariant()} · {definition.Tier}", "card-topline"));
            card.Add(Text(CardGlyph(definition), "card-glyph"));
            card.Add(Text(definition.Name, "card-name"));
            card.Add(Text(CardDetail(definition), "card-detail"));
            if (definition.Style > 0) card.Add(Text($"+{definition.Style} STYLE", "style-pip"));
            card.Add(ActionButton("View larger", () => Inspect(definition), "card-inspect"));

            if (instance != null)
            {
                var signal = _engine
                    .LegalActions(_visibleRole)
                    .FirstOrDefault(action =>
                        action.Type == GameActionType.SignalCard && action.InstanceId == instance.InstanceId
                    );
                if (signal != null && _engine.State.Phase != TurnPhase.Freshen)
                {
                    var captured = signal;
                    card.Add(ActionButton("Signal", () => ShowSignal(captured), "card-secondary"));
                }
                if (showDiscardToggle)
                {
                    var toggle = new Toggle("Discard")
                    {
                        value = _selectedDiscards.Contains(instance.InstanceId),
                    };
                    toggle.AddToClassList("discard-toggle");
                    toggle.RegisterValueChangedCallback(change =>
                    {
                        if (change.newValue) _selectedDiscards.Add(instance.InstanceId);
                        else _selectedDiscards.Remove(instance.InstanceId);
                    });
                    card.Add(toggle);
                }
            }
            return card;
        }

        private void ConfigureCardDrag(VisualElement card, CardDefinition definition, CardInstance instance)
        {
            card.RegisterCallback<PointerDownEvent>(evt => BeginCardDrag(evt, card, definition, instance));
            card.RegisterCallback<PointerMoveEvent>(MoveCardDrag);
            card.RegisterCallback<PointerUpEvent>(EndCardDrag);
            card.RegisterCallback<PointerCaptureOutEvent>(evt =>
            {
                if (_dragPointerId != evt.pointerId) return;
                if (_dragActive && _draggedInstance != null)
                    SuppressNextCardClick(_draggedInstance.InstanceId);
                ResetCardDrag();
            });
        }

        private void BeginCardDrag(
            PointerDownEvent evt,
            VisualElement card,
            CardDefinition definition,
            CardInstance instance
        )
        {
            if (evt.button != 0 || IsInteractiveControl(evt.target as VisualElement)) return;
            if (DropActionsFor(instance.InstanceId).Count == 0) return;

            _dragSource = card;
            _draggedInstance = instance;
            _draggedDefinition = definition;
            _dragStart = PointerPosition(evt.position);
            _dragPointerId = evt.pointerId;
            _dragActive = false;
            card.CapturePointer(evt.pointerId);
            evt.StopPropagation();
        }

        private void MoveCardDrag(PointerMoveEvent evt)
        {
            if (_draggedInstance == null || evt.pointerId != _dragPointerId) return;
            var point = PointerPosition(evt.position);
            if (!_dragActive && Vector2.Distance(_dragStart, point) < DragThreshold) return;

            if (!_dragActive)
            {
                _dragActive = true;
                _dragSource?.AddToClassList("drag-source");
                _floorDropZone?.AddToClassList("drop-target");
                _dragPreview = BuildDragPreview(_draggedDefinition);
                _document.rootVisualElement.Add(_dragPreview);
            }

            PositionDragPreview(point);
            var overFloor = _floorDropZone?.worldBound.Contains(point) == true;
            _floorDropZone?.EnableInClassList("drop-target-active", overFloor);
            evt.StopPropagation();
        }

        private void EndCardDrag(PointerUpEvent evt)
        {
            if (_draggedInstance == null || evt.pointerId != _dragPointerId) return;
            var instance = _draggedInstance;
            var definition = _draggedDefinition;
            var point = PointerPosition(evt.position);
            var wasDragging = _dragActive;
            var droppedOnFloor = wasDragging && _floorDropZone?.worldBound.Contains(point) == true;
            if (wasDragging) SuppressNextCardClick(instance.InstanceId);
            ResetCardDrag();
            if (!wasDragging) return;

            evt.StopPropagation();
            if (droppedOnFloor) PlayDroppedCard(instance, definition);
        }

        private VisualElement BuildDragPreview(CardDefinition definition)
        {
            var preview = Element("dance-card");
            preview.AddToClassList("drag-preview");
            preview.AddToClassList($"type-{definition.Type}");
            preview.AddToClassList($"tier-{definition.Tier.ToLowerInvariant()}");
            preview.pickingMode = PickingMode.Ignore;
            preview.Add(Text($"{definition.Type.ToUpperInvariant()} · {definition.Tier}", "card-topline"));
            preview.Add(Text(CardGlyph(definition), "card-glyph"));
            preview.Add(Text(definition.Name, "card-name"));
            preview.Add(Text(CardDetail(definition), "card-detail"));
            if (definition.Style > 0) preview.Add(Text($"+{definition.Style} STYLE", "style-pip"));
            return preview;
        }

        private void PositionDragPreview(Vector2 point)
        {
            if (_dragPreview == null) return;
            _dragPreview.style.left = point.x + 16f;
            _dragPreview.style.top = point.y - 105f;
        }

        private void ResetCardDrag()
        {
            var source = _dragSource;
            var pointerId = _dragPointerId;
            _dragPointerId = -1;
            _dragSource = null;
            _draggedInstance = null;
            _draggedDefinition = null;
            _dragActive = false;
            source?.RemoveFromClassList("drag-source");
            _floorDropZone?.RemoveFromClassList("drop-target");
            _floorDropZone?.RemoveFromClassList("drop-target-active");
            _dragPreview?.RemoveFromHierarchy();
            _dragPreview = null;
            if (source != null && pointerId >= 0 && source.HasPointerCapture(pointerId))
                source.ReleasePointer(pointerId);
        }

        private List<GameAction> DropActionsFor(string instanceId)
        {
            if (_engine == null) return new List<GameAction>();
            var legalActions = _engine.LegalActions(_visibleRole);
            if (_engine.State.Table.Position == null)
            {
                return legalActions
                    .Where(action =>
                        action.Type == GameActionType.PlayOpen
                        && (
                            string.IsNullOrEmpty(_pendingOpenPositionInstanceId)
                                ? action.PositionInstanceId == instanceId
                                : action.PositionInstanceId == _pendingOpenPositionInstanceId
                                    && action.MoveInstanceId == instanceId
                        )
                    )
                    .OrderBy(action => action.StableKey, StringComparer.Ordinal)
                    .ToList();
            }

            return legalActions
                .Where(action => ActionUsesCard(action, instanceId))
                .OrderBy(action => action.StableKey, StringComparer.Ordinal)
                .ToList();
        }

        private static bool ActionUsesCard(GameAction action, string instanceId)
        {
            return action.Type switch
            {
                GameActionType.PlayOpen => action.PositionInstanceId == instanceId || action.MoveInstanceId == instanceId,
                GameActionType.PlayMove => action.MoveInstanceId == instanceId,
                GameActionType.Transition => action.PositionInstanceId == instanceId,
                GameActionType.PlayFlourish => action.FlourishInstanceId == instanceId,
                GameActionType.Stumble => action.RecoveryInstanceId == instanceId,
                _ => false,
            };
        }

        private void PlayDroppedCard(CardInstance instance, CardDefinition definition)
        {
            var choices = DropActionsFor(instance.InstanceId);
            if (choices.Count == 0)
            {
                _error = $"{definition.Name} cannot be played on the floor right now.";
                RenderGame();
                return;
            }

            if (
                _engine.State.Table.Position == null
                && string.IsNullOrEmpty(_pendingOpenPositionInstanceId)
                && choices.Any(action => action.PositionInstanceId == instance.InstanceId)
            )
            {
                _pendingOpenPositionInstanceId = instance.InstanceId;
                _error = null;
                RenderGame();
                return;
            }

            if (choices.Count != 1)
            {
                _error = $"{definition.Name} did not resolve to exactly one legal floor play.";
                RenderGame();
                return;
            }

            ApplyAction(choices[0]);
        }

        private void CancelStagedPosition()
        {
            _pendingOpenPositionInstanceId = null;
            _error = null;
            RenderGame();
        }

        private CardInstance PendingOpenPosition(GameState state)
        {
            if (string.IsNullOrEmpty(_pendingOpenPositionInstanceId)) return null;
            return state.Player(_visibleRole).Hand.FirstOrDefault(instance =>
                instance.InstanceId == _pendingOpenPositionInstanceId
            );
        }

        private void ValidatePendingOpening(GameState state)
        {
            if (string.IsNullOrEmpty(_pendingOpenPositionInstanceId)) return;
            var pending = state.Player(_visibleRole).Hand.FirstOrDefault(instance =>
                instance.InstanceId == _pendingOpenPositionInstanceId
            );
            if (
                state.Status != GameStatus.Playing
                || state.Phase != TurnPhase.Dance
                || state.ActiveRole != _visibleRole
                || state.Table.Position != null
                || pending == null
                || _content.Card(pending.CardId).Type != "position"
            ) _pendingOpenPositionInstanceId = null;
        }

        private static bool IsInteractiveControl(VisualElement target)
        {
            return target is Button
                || target?.GetFirstAncestorOfType<Button>() != null
                || target is Toggle
                || target?.GetFirstAncestorOfType<Toggle>() != null;
        }

        private void SuppressNextCardClick(string instanceId)
        {
            _suppressCardClickInstanceId = instanceId;
            _document.rootVisualElement.schedule.Execute(() =>
            {
                if (_suppressCardClickInstanceId == instanceId) _suppressCardClickInstanceId = null;
            });
        }

        private static Vector2 PointerPosition(Vector3 position) => new(position.x, position.y);

        private VisualElement TableSlot(string label, CardInstance instance, bool staged = false)
        {
            var slot = Element("table-slot");
            if (staged) slot.AddToClassList("staged-slot");
            slot.Add(Text(staged ? $"{label} · STAGED" : label, "slot-label"));
            if (instance == null) slot.Add(Text("—", "empty-slot"));
            else
            {
                slot.Add(BuildCard(_content.Card(instance.CardId)));
                if (staged) slot.Add(Text("WAITING FOR MOVE", "staged-badge"));
            }
            return slot;
        }

        private VisualElement BuildPassOverlay(GameState state)
        {
            var overlay = Element("overlay");
            var dialog = Element("pass-dialog");
            dialog.Add(Text("KEEP THE HAND PRIVATE", "eyebrow"));
            dialog.Add(Text($"Pass to the\n{RoleName(ViewerRole())}", "pass-title"));
            dialog.Add(Text("When your partner has the Mac, continue below.", "body-copy"));
            dialog.Add(ActionButton($"I'm the {RoleName(ViewerRole())}", AcceptPass, "primary"));
            overlay.Add(dialog);
            return overlay;
        }

        private VisualElement BuildSignalOverlay(GameState state)
        {
            var overlay = Element("overlay");
            var dialog = Element("signal-dialog");
            var player = state.Player(state.Signal.Role);
            var instance = player.Hand.First(entry => entry.InstanceId == state.Signal.InstanceId);
            dialog.Add(Text("SHOW ONLY THIS CARD TO YOUR PARTNER", "eyebrow"));
            dialog.Add(BuildCard(_content.Card(instance.CardId)));
            dialog.Add(ActionButton("Hide it again", HideSignal, "primary"));
            overlay.Add(dialog);
            return overlay;
        }

        private VisualElement BuildCardInspector(CardDefinition definition)
        {
            var overlay = Element("overlay");
            overlay.RegisterCallback<ClickEvent>(_ => CloseInspector());
            var dialog = Element("inspector-dialog");
            dialog.RegisterCallback<ClickEvent>(evt => evt.StopPropagation());
            dialog.Add(Text("CARD DETAIL", "eyebrow"));
            dialog.Add(BuildCard(definition));
            dialog.Add(ActionButton("Close", CloseInspector, "secondary"));
            overlay.Add(dialog);
            return overlay;
        }

        private VisualElement BuildTerminal(GameState state)
        {
            var terminal = Element("terminal");
            terminal.Add(Text(state.Status == GameStatus.Completed ? "THE FINAL 8-COUNT" : "THE CONNECTION BROKE", "eyebrow"));
            terminal.Add(Text(state.Status == GameStatus.Completed ? state.Rating : "The dance ends here", "terminal-title"));
            terminal.Add(Text((state.FinalScore ?? 0).ToString(), "final-score"));
            terminal.Add(Text("FINAL SCORE", "muted"));
            terminal.Add(Text($"{state.Shared.Style} Style + {state.Shared.Connection} Connection", "score-equation"));
            terminal.Add(ActionButton("Dance again", StartNewGame, "primary"));
            terminal.Add(ActionButton("Back home", BackHome, "secondary"));
            return terminal;
        }

        private void ApplyAction(GameAction action)
        {
            if (action.Type == GameActionType.Freshen)
                action.DiscardInstanceIds = _selectedDiscards.ToList();
            var beforeViewer = ViewerRole();
            var result = _engine.Apply(action);
            if (!result.Ok)
            {
                _error = result.Message;
                RenderGame();
                return;
            }
            _error = null;
            _pendingOpenPositionInstanceId = null;
            _selectedDiscards.Clear();
            GamePersistence.Save(_engine);
            var afterViewer = ViewerRole();
            _visibleRole = afterViewer;
            if (beforeViewer != afterViewer && _engine.State.Status is GameStatus.Setup or GameStatus.Playing)
                _awaitingPass = true;
            RenderGame();
        }

        private void ShowSignal(GameAction action)
        {
            var result = _engine.Apply(action);
            if (!result.Ok)
            {
                _error = result.Message;
                RenderGame();
                return;
            }
            GamePersistence.Save(_engine);
            _signalPeek = true;
            RenderGame();
        }

        private void HideSignal()
        {
            var clear = _engine.LegalActions(_visibleRole).FirstOrDefault(action => action.Type == GameActionType.ClearSignal);
            if (clear != null) _engine.Apply(clear);
            _signalPeek = false;
            GamePersistence.Save(_engine);
            RenderGame();
        }

        private void AcceptPass()
        {
            _visibleRole = ViewerRole();
            _awaitingPass = false;
            RenderGame();
        }

        private void Inspect(CardDefinition definition)
        {
            _inspectedCard = definition;
            RenderGame();
        }

        private void CloseInspector()
        {
            _inspectedCard = null;
            RenderGame();
        }

        private void BackHome()
        {
            _engine = null;
            _pendingOpenPositionInstanceId = null;
            _inspectedCard = null;
            _signalPeek = false;
            _awaitingPass = false;
            RenderHome();
        }

        private Role ViewerRole()
        {
            if (_engine.State.Status == GameStatus.Setup) return _engine.State.SetupRole;
            return _engine.State.ActiveRole;
        }

        private static bool ShowInActionStrip(GameAction action)
        {
            return action.Type is not GameActionType.PlayOpen
                and not GameActionType.SignalCard
                and not GameActionType.ClearSignal
                and not GameActionType.BuyLesson
                and not GameActionType.LearnFromPartner;
        }

        private string ActionLabel(GameAction action)
        {
            return action.Type switch
            {
                GameActionType.Mulligan => "Mulligan once",
                GameActionType.ConfirmHand => "Keep this hand",
                GameActionType.PlayOpen => $"Open: {InstanceName(action.PositionInstanceId)} + {InstanceName(action.MoveInstanceId)}",
                GameActionType.PlayMove => $"Dance {InstanceName(action.MoveInstanceId)}",
                GameActionType.Transition => $"Transition to {InstanceName(action.PositionInstanceId)}",
                GameActionType.PlayFlourish => $"Flourish: {InstanceName(action.FlourishInstanceId)}",
                GameActionType.EndDance => _engine.State.TurnDance.CardsPlayed == 0 ? "Dance the basic" : "Finish the 8-count",
                GameActionType.Stumble => string.IsNullOrEmpty(action.RecoveryInstanceId)
                    ? "Stumble · −2 Connection"
                    : $"Stumble · {InstanceName(action.RecoveryInstanceId)}",
                GameActionType.EndLesson => "Finish lessons",
                GameActionType.Freshen => "Freshen up & end turn",
                GameActionType.UndoTurn => "Reset turn",
                _ => action.Type.ToString(),
            };
        }

        private static string ActionClass(GameAction action)
        {
            return action.Type switch
            {
                GameActionType.EndDance or GameActionType.EndLesson or GameActionType.Freshen or GameActionType.ConfirmHand => "primary",
                GameActionType.Stumble => "danger",
                GameActionType.UndoTurn => "text-action",
                _ => "secondary",
            };
        }

        private string InstanceName(string instanceId)
        {
            var instance = _engine.State.Player(_visibleRole).Hand.FirstOrDefault(entry => entry.InstanceId == instanceId);
            return instance == null ? "Card" : _content.Card(instance.CardId).Name;
        }

        private static string ActionHeading(GameState state)
        {
            if (state.Status == GameStatus.Setup) return "OPENING HAND";
            return state.Phase switch
            {
                TurnPhase.Dance => "DANCE · CHOOSE YOUR STEP",
                TurnPhase.Lesson => "TAKE A LESSON · OR KEEP MOVING",
                TurnPhase.Freshen => "FRESHEN UP · DISCARD ANY CARDS",
                _ => "YOUR TURN",
            };
        }

        private static string CardGlyph(CardDefinition card)
        {
            return card.Type switch
            {
                "position" => "◇",
                "move" => "↝",
                "flourish" => "✦",
                _ => "↺",
            };
        }

        private static string CardDetail(CardDefinition card)
        {
            return card.Type switch
            {
                "position" => card.Position,
                "move" => string.Join(" · ", card.Positions),
                "flourish" => card.Positions.Count == 0 ? "Any position" : string.Join(" · ", card.Positions),
                "recovery" => $"Stumble costs {card.ConnectionCost} Connection",
                _ => string.Empty,
            };
        }

        private static string RoleName(Role role) => role == Role.Lead ? "Lead" : "Follow";

        private static VisualElement Stat(string label, string value)
        {
            var stat = Element("hud-stat");
            stat.Add(Text(label, "stat-label"));
            stat.Add(Text(value, "stat-value"));
            return stat;
        }

        private static VisualElement Element(string className)
        {
            var element = new VisualElement();
            element.AddToClassList(className);
            return element;
        }

        private static Label Text(string value, string className)
        {
            var label = new Label(value);
            label.AddToClassList(className);
            return label;
        }

        private static Button ActionButton(string label, Action action, string className)
        {
            var button = new Button(action) { text = label };
            button.AddToClassList(className);
            return button;
        }

        private void RenderFatal(string message)
        {
            if (_document == null)
            {
                _document = gameObject.AddComponent<UIDocument>();
                _document.panelSettings = Resources.Load<PanelSettings>("ClavePanelSettings");
            }
            var root = Root();
            var panel = Element("fatal");
            panel.Add(Text("CLAVE COULD NOT START", "section-title"));
            panel.Add(Text(message, "body-copy"));
            root.Add(panel);
        }
    }
}
