// Shared content model for the DICE UAT checklist — single source of truth
// consumed by both build-uat-checklist.mjs (Word) and
// build-uat-checklist-xlsx.mjs (Excel), so the two formats never drift.
// Each section is a numbered table of test cases: [action, expected][].
export const SECTIONS = []
let sectionCounter = 0
function section(title, cases) {
  sectionCounter += 1
  SECTIONS.push({ sectionNo: sectionCounter, title, cases })
}

// 1 ───────────────────────────────────────────────────────────────────────────
section('Installation & First Launch', [
  ['Download DICE-Setup.exe and run it on a clean machine (or a machine without a prior DICE install).', 'Installer launches; if unsigned, Windows SmartScreen shows "Windows protected your PC" — "More info" → "Run anyway" proceeds normally.'],
  ['Step through the installer wizard.', 'No administrator password is required (per-user install); wizard completes and offers to launch DICE.'],
  ['Confirm Start Menu / desktop shortcuts were created ("DICE" and "DICE (LAN Host)").', 'Both shortcuts exist and point at the installed app.'],
  ['Launch DICE from the Start Menu shortcut.', 'A minimized console window titled "DICE Server" appears; default browser opens automatically to http://127.0.0.1:3001.'],
  ['Close the "DICE Server" console window, then try to use the app in the browser.', 'The app stops responding to server calls — confirms the console window is the running engine, not just a log viewer.'],
  ['Relaunch DICE and confirm the browser opens automatically without manual navigation.', 'Browser opens to the app within a few seconds without user action.'],
  ['On a fresh (no prior data) install, confirm the very first screen is first-run Setup, not Login.', 'Setup screen ("Create the admin account") appears; Login is unreachable until setup completes.'],
])

// 2 ───────────────────────────────────────────────────────────────────────────
section('First-Run Setup & Authentication', [
  ['On the Setup screen, submit with an empty username.', 'Submit button stays disabled; no request is sent.'],
  ['Enter a username containing a space or symbol outside ._- (e.g. "K C Yerrid").', 'An inline amber warning explains the allowed characters; the button stays disabled with a visible reason (not silently disabled).'],
  ['Enter a password under 8 characters.', 'Inline warning "Password is too short (need 8+)" appears.'],
  ['Enter two different values in Password and Confirm Password.', 'Inline warning "Passwords don\'t match yet" appears.'],
  ['Fill all fields validly and submit.', 'Admin account is created, you are signed in immediately, and you land on the Home screen.'],
  ['Reload the app after completing setup, or navigate directly to /setup.', '/setup redirects away (to Home if signed in, or Login if not) — it never reappears once an admin exists.'],
  ['Sign out, then sign in again with the correct username/password.', 'Successful sign-in returns you to Home.'],
  ['Attempt sign-in with a wrong password 5 times in a row on the same username.', 'The 5th attempt (or the one after) reports the account is locked for 15 minutes; further correct-password attempts are still rejected until the lock clears.'],
  ['Attempt sign-in with an unknown username.', 'Generic "invalid credentials"-style error — does not reveal whether the username exists.'],
  ['Sign in on two different browsers/devices as the same user, then change the password from Account settings on one of them.', 'The device that changed the password stays signed in; the other device is signed out on its next action.'],
  ['Let a session sit idle past its token, then take an action (or simulate by clearing the token).', 'You are routed to Login with a "session expired" notice, not a raw error.'],
  ['Attempt to reach any protected route (e.g. /roster) while signed out.', 'Redirected to Login.'],
])

// 3 ───────────────────────────────────────────────────────────────────────────
section('Navigation, Command Palette & Sidebar', [
  ['Sign in and observe the left sidebar.', 'Sidebar shows a "Play" group with Home, Scenarios, Roster, Campaigns, Content Packs, Analytics, Host Game, Join Game, Account; an "Admin" group (admin users only) with Users, Scenario Library, Injects Catalog, Admin Analytics; and a footer with your name/role, Account, and Sign Out.'],
  ['Sign in as a Player (non-admin) account.', 'The Admin group is not shown in the sidebar or the command palette.'],
  ['Click the collapse arrow at the top of the sidebar.', 'Sidebar shrinks to an icon-only rail; labels disappear but icons and active-page highlight remain.'],
  ['Reload the page after collapsing the sidebar.', 'Collapsed state persists across reloads (saved to local storage).'],
  ['Navigate to a live game session (/game) or a room (/play).', 'Sidebar auto-collapses to the icon rail on these dense screens even if your saved preference is expanded.'],
  ['On /game or /play, manually expand the sidebar via the toggle.', 'It expands for that visit without changing your saved global preference — navigating away and back re-collapses it.'],
  ['Press Ctrl+K (or Cmd+K on Mac) from any page.', 'A command palette overlay opens centered on screen with a search input focused.'],
  ['Type a partial page name (e.g. "rost") into the palette.', 'Results filter live to matching entries (e.g. "Roster").'],
  ['Press Escape while the palette is open.', 'Palette closes without navigating.'],
  ['Use arrow keys to highlight a result, then press Enter.', 'Navigates to the highlighted page and closes the palette.'],
  ['Click the "Search…" affordance at the bottom of an expanded sidebar.', 'Opens the same command palette as Ctrl+K.'],
  ['As a Player account, open the command palette and check for admin entries.', 'No admin-only destinations appear in the results.'],
])

// 4 ───────────────────────────────────────────────────────────────────────────
section('Accessibility (Motion, Color, Notifications)', [
  ['Enable "prefers-reduced-motion" (OS accessibility setting, or DevTools Rendering tab → Emulate CSS media feature).', 'Scanline overlay, pulse/slide/fade/shake animations, and framer-motion transitions across the app stop or become near-instant.'],
  ['Trigger a critical hit, success, partial, failure, and critical fail roll in a game session (or simulate each).', 'Every outcome shows a distinct glyph (⚡ ✓ ~ ✗ ☠) and text label alongside its color — never color alone.'],
  ['Emulate a color-blindness filter (DevTools Rendering → Emulate vision deficiencies) during a dice roll.', 'You can still tell success from failure via the glyph/checkmark and text, independent of color.'],
  ['Trigger an action that produces a toast (e.g. an admin action succeeding or failing).', 'A toast appears bottom-right with an icon, message, and close (×) button; it auto-dismisses after a few seconds.'],
  ['Inspect the toast region with a screen reader or the browser accessibility tree.', 'The toast container is announced via aria-live (assertive for errors, polite for success/info).'],
  ['View the Detection DC values in Adversary Mode\'s tactic list.', 'Low-DC (risky) options show a ⚠ marker, moderate ones a △ marker — not color alone.'],
])

// 5 ───────────────────────────────────────────────────────────────────────────
section('Account Settings', [
  ['Open Account from the sidebar.', 'Profile card shows Username, Display Name, and Role as read-only, with a note that only an admin can change them.'],
  ['Submit a password change with a new password under 8 characters.', 'Validation blocks submission with a clear message.'],
  ['Submit a password change where confirmation doesn\'t match the new password.', 'Validation blocks submission.'],
  ['Submit a password change with the new password identical to the current one.', 'Rejected with a message that it must differ from the current password.'],
  ['Submit a valid current password + valid new password (matching confirmation).', 'Success message states the password was updated and other devices were signed out.'],
  ['Submit with an incorrect current password.', 'Rejected with an error; new password is not applied.'],
])

// 6 ───────────────────────────────────────────────────────────────────────────
section('Admin — User Management', [
  ['As an admin, open Users and click "+ New User".', 'Modal opens with Username, Display Name, Initial Password, and Role fields.'],
  ['Enter a username with an invalid character (e.g. a space).', 'Inline warning appears explaining the allowed format; Create button stays disabled.'],
  ['Create a valid new user as role "player".', 'User appears in the list immediately, active, with the chosen role.'],
  ['Create a second user as role "admin".', 'New admin appears in the list; both admins can independently manage users.'],
  ['Reset a user\'s password.', 'Confirmation banner shows; that user\'s active sessions are revoked (they must sign in again with the new password).'],
  ['Click "Sign out all" for a user who is currently signed in elsewhere.', 'Their sessions are revoked without changing their password.'],
  ['Disable a user account, then attempt to sign in as that user.', 'Sign-in is rejected; existing sessions for that user stop working.'],
  ['Re-enable a disabled account and sign in as that user.', 'Sign-in succeeds again.'],
  ['Change a user\'s role from player to admin (and back).', 'Role updates immediately; their sidebar/command palette Admin group appears or disappears on next load.'],
  ['Attempt to disable, sign-out, or demote your own currently-signed-in admin account.', 'Action is blocked/greyed out — an admin cannot lock themselves out.'],
  ['Enable self-service registration with an invite code, then open /register in a private/incognito window and register using that code.', 'New account is created as role "player" only; it cannot self-register as admin.'],
  ['Disable self-service registration (clear the invite code) and try /register again.', 'Registration is refused (403-style behavior) with no code set.'],
])

// 7 ───────────────────────────────────────────────────────────────────────────
section('Character Roster & Avatars', [
  ['From Roster, click "+ Add Character" (or the equivalent create flow) and complete character creation.', 'New character appears on the Roster page with chosen class, base stats, and starting skill.'],
  ['Click a character\'s portrait/headshot circle.', 'Avatar picker opens showing the "Class" tab pre-selected, scoped to that character\'s class.'],
  ['Switch to the "All" tab in the avatar picker.', 'Grid shows avatars from every class; a class-name label appears under each thumbnail that isn\'t the character\'s own class.'],
  ['Inspect avatar thumbnails on the "All" tab closely.', 'No transparency/overlay obscures any part of the avatar artwork — the class label sits fully below the image, not on top of it.'],
  ['Select an avatar from either tab.', 'Picker closes; the chosen avatar becomes the character\'s headshot immediately.'],
  ['Click "Upload Custom Photo" and choose a local image file.', 'Custom image is applied as the headshot and the picker closes.'],
  ['Click outside the avatar picker modal (on the dark backdrop).', 'Modal closes without changing the selection; underlying page content is not visibly legible through the backdrop.'],
  ['Select multiple characters via their selection checkmarks on the Roster grid.', 'Selected count updates; "Select all" / "Deselect all" toggle works.'],
  ['Remove a character from the roster (✕ button).', 'Character is deleted from the roster after any confirmation and no longer appears.'],
  ['Add a character from the Character Library (pack-imported).', 'A copy is added to your personal roster with a new ID; the pack original remains untouched.'],
  ['Reload the app (or sign out/in) after roster changes.', 'All roster changes (adds, removes, avatar changes) persisted correctly and reload identically.'],
])

// 8 ───────────────────────────────────────────────────────────────────────────
section('Scenario Selection', [
  ['Open Scenarios from the sidebar.', 'Scenarios are grouped into collapsible category folders (e.g. Malware, Ransomware, Phishing & BEC) with counts.'],
  ['Expand and collapse a category folder.', 'Folder toggles open/closed and remembers scenario count in its header.'],
  ['Locate the tutorial/introductory scenario.', 'It is marked with a "START HERE" badge.'],
  ['Locate a custom scenario you authored.', 'It appears in its own "Custom" folder with a "CUSTOM" badge, and a "Manage →" shortcut to Campaign Builder.'],
  ['Open a scenario card\'s details.', 'Shows difficulty tier (color-coded), estimated duration, recommended player count, summary, and victory/failure conditions.'],
  ['Select a scenario and proceed to Roster / character assignment.', 'Chosen scenario carries forward correctly into the session-launch flow.'],
])

// 9 ───────────────────────────────────────────────────────────────────────────
section('Campaign Builder & Organizational Profile', [
  ['Open Campaigns and switch between the "Campaigns" and "Scenarios" tabs.', 'Both tabs render correctly; the Scenarios tab reuses the same editor used in Admin Scenario Library, scoped to your own custom scenarios.'],
  ['Create a new campaign with a name, description, and status.', 'Campaign is created and appears in your campaign list.'],
  ['Add multiple scenarios to a campaign\'s sequence, then reorder them with ↑/↓.', 'Order updates and persists; "Scenario X of Y" progress indicator reflects the new order.'],
  ['Assign roster characters to a campaign.', 'Selected characters toggle on/off in the assignment grid and persist on save.'],
  ['Click "▶ Play Next" on a campaign with a non-empty, non-completed sequence.', 'Launches directly into the next unplayed scenario in the sequence.'],
  ['Expand the Organizational Profile section and fill in several tool-stack fields (SIEM, EDR, Identity Provider, etc.).', 'Header updates to reflect "N of 20 set"; values persist and are available to the DM during play.'],
  ['Leave several Organizational Profile fields blank and start a session.', 'DM narration treats the blanks as real capability gaps rather than assuming generic tools.'],
  ['Fork a built-in scenario using the "Fork ↗" option.', 'A new custom scenario is created pre-filled from the original, editable independently.'],
  ['Delete a campaign.', 'Removed from your list after confirmation; does not affect other users\' campaigns.'],
])

// 10 ──────────────────────────────────────────────────────────────────────────
section('Content Packs — Import & Export', [
  ['Attempt to import a non-JSON file as a .dicepack.', 'Rejected with "That file is not valid JSON — a .dicepack must be a JSON file."'],
  ['Import a malformed or incomplete .dicepack JSON file.', '"Pack rejected:" followed by specific validation errors — no partial import occurs.'],
  ['Import a valid .dicepack file.', 'Success message states the pack name, version, and counts of scenarios/characters installed; new content appears in Scenario Select / Character Library immediately.'],
  ['Disable an installed pack.', 'Pack shows a "disabled" badge; its scenarios/characters disappear from Scenario Select and the Character Library without being deleted.'],
  ['Re-enable a disabled pack.', 'Its content reappears everywhere it was before.'],
  ['Uninstall a pack.', 'Confirmation names the exact scenario/character counts that will be removed; after confirming, they are gone from the library.'],
  ['Create an export pack with no scenarios or characters selected.', 'Blocked with "Select at least one scenario or character to include."'],
  ['Create and export a pack with a duplicate/invalid Pack ID format.', 'Validation error surfaces before the file is generated.'],
  ['Export a valid pack with at least one scenario and one character selected.', 'A .dicepack file downloads; re-importing it on another account reproduces the same content.'],
])

// 11 ──────────────────────────────────────────────────────────────────────────
section('Solo Game Session — Core Gameplay', [
  ['Launch a solo session with one character and a configured AI provider key.', 'DM narrates an opening scene; initiative/turn order is established.'],
  ['On your turn, select a Primary action for your class.', 'Action is added with no DC penalty; class-specific actions are visually distinguished from Secondary ones.'],
  ['Select a Secondary action instead.', 'A +2 DC penalty is clearly indicated before you declare the action.'],
  ['Use "⚡ Improvise" instead of a listed action.', 'Free-text action is accepted with a +3 DC penalty shown.'],
  ['Use a "quick-fill" sub-action suggestion, then edit the pre-filled text.', 'Textarea populates with the suggested rationale and remains editable before declaring.'],
  ['Declare an action and roll.', 'd20 animates, final result and modifiers (stat + skill/trait bonuses) are shown, and an outcome tier (Critical Hit/Success/Partial/Failure/Critical Fail) is announced with matching glyph, label, and color.'],
  ['Roll a natural 20 and a natural 1 in separate turns.', 'Natural 20 always resolves as Critical Hit and natural 1 as Critical Fail regardless of modifiers.'],
  ['Use the Hint button in Analyst timer mode.', 'Button label itself shows "Hint (+2 DC)"; after use, an accumulated "+N used" badge appears once more than one hint is taken.'],
  ['Use the Hint button in Rookie or No-Timer mode.', 'No DC penalty is shown or applied.'],
  ['Attempt to use Hint in Senior or Elite timer mode.', 'Hint button is not available in these modes.'],
  ['Let the per-round timer expire without acting.', 'Turn\'s difficulty increases (DC +4) and this is reflected in the round\'s outcome.'],
  ['Trigger a scenario inject (via normal play or Facilitator controls).', 'Inject appears in the narrative feed and applies its stated mechanical effect (kill-chain advance, complication, etc.).'],
  ['Accumulate an active complication.', 'Complication badge with count is visible and affects subsequent difficulty as described in the scenario.'],
  ['Watch the Last Roll panel after several rolls.', 'Shows the total prominently, the raw roll + modifier breakdown, a ✓/✗ pass/fail indicator next to the total, and the outcome label — all legible at normal viewing distance.'],
  ['Watch the Attacker kill-chain panel as stages advance.', 'Current stage is highlighted, reached stages are struck through, and each stage\'s MITRE ATT&CK technique ID is legible (not the previous illegibly small text).'],
  ['Watch the XP Scorecard update after each roll.', 'Per-outcome XP gain flashes, level badge and progress bar update, and all values (XP total, "X to next level") are clearly readable.'],
  ['Progress through multiple Acts in a scenario.', 'Act transitions announce the new objective and any boss event correctly.'],
  ['Reach the scenario\'s victory condition.', 'Session ends with a "CONTAINED" outcome and routes to Session End.'],
  ['Let the scenario clock or failure condition trigger a loss.', 'Session ends with "BREACH" (defeat) or "PARTIAL" (timeout) as appropriate.'],
])

// 12 ──────────────────────────────────────────────────────────────────────────
section('Adversary Mode', [
  ['Start a session in Adversary Mode with 2+ characters.', 'One character becomes the threat actor; the rest form the defending team.'],
  ['As the adversary, review the tactic options list.', 'Each option shows a Detection DC (with ⚠/△ risk markers), stealth cost if caught, and target kill-chain stage where applicable.'],
  ['Select and roll an evasion action.', 'Roll resolves against the detection DC; result is labeled EVADED or DETECTED (not color alone).'],
  ['Get detected on an adversary action.', 'Stealth score decreases by the stated cost; defenders receive appropriate narrative/mechanical feedback.'],
  ['Successfully evade detection and advance a kill-chain stage.', 'Kill-chain progress updates and is visible to the defending side\'s panel.'],
])

// 13 ──────────────────────────────────────────────────────────────────────────
section('Multiplayer Rooms — Hosting & Joining', [
  ['As a signed-in user, open Host Game and create a room with a name and facilitator passphrase under 4 characters.', 'Blocked with a minimum-length validation message.'],
  ['Create a room with a valid passphrase.', 'Room is created; you land in the Lobby with a shareable room code and (if available) a QR code / join link.'],
  ['As a second signed-in user (different account, different browser/profile), open Join Game with an empty roster.', 'Prompted to create a character first (link to Character Create) instead of being shown a class picker.'],
  ['As the second user with at least one roster character, open Join Game and enter the room code.', 'Your own roster characters are listed (name, class, level, XP) to choose from — not a fresh class-only picker.'],
  ['Select one of your characters and join.', 'You land in the Lobby as a player; the facilitator\'s participant list shows your character\'s name.'],
  ['Attempt to join a room while signed out, or with a tampered/invalid character ID, via direct API call (or by inspecting network requests).', 'Unauthenticated join is rejected (401); joining with a character ID that isn\'t in your own roster is rejected (404) — you cannot bring another user\'s character into a room.'],
  ['With the facilitator and at least one player in the Lobby, start the session.', 'Facilitator runs the DM; the player\'s screen shows the live narrative feed streaming in.'],
  ['Play a room session through to a terminal outcome (victory/defeat/timeout).', 'Session ends normally for the facilitator; XP is computed the same way as solo (team-split total).'],
  ['After the room session ends, sign in as the player account and check Roster.', 'The character that was played shows increased XP reflecting the session — confirming XP carried back to the player\'s own persisted character, not just a throwaway room character.'],
  ['Check the facilitator\'s own Roster after the same session.', 'Facilitator\'s personal roster is unaffected by the players\' XP awards (no cross-contamination).'],
  ['If the session\'s XP crossed a level threshold for a player\'s character, check that player\'s Roster page.', 'A pulsing "★ Level Up Available" banner appears below that character\'s card, positioned under the card (not overlapping the stats/skills).'],
  ['Click the "Level Up Available" banner.', 'The same upgrade-choice modal used in solo Session End opens, offering available skill/trait/stat upgrades for that character.'],
  ['Confirm an upgrade choice.', 'Character\'s level, and the chosen skill/trait/stat, update immediately; the banner disappears.'],
  ['Use the facilitator passphrase to reclaim facilitator control from a second device/browser.', 'Reclaim succeeds with the correct passphrase and fails with an incorrect one.'],
  ['During a room session, use the Voice DM toggle as a player.', 'Player can independently enable/disable and configure narration without affecting the facilitator\'s or other players\' settings.'],
])

// 14 ──────────────────────────────────────────────────────────────────────────
section('Voice Narration', [
  ['In a solo session, enable Voice DM from the toolbar toggle.', 'Toggle shows an active/pulsing indicator; narration begins being spoken as it streams in.'],
  ['Open Voice DM settings and change voice, rate, and pitch, then click "Test Voice".', 'A sample line plays using the selected voice/rate/pitch.'],
  ['Disable Voice DM mid-narration.', 'Speech stops immediately.'],
  ['Leave a session running with Voice DM enabled for several minutes (covering the ~15s browser auto-stop quirk).', 'Narration continues uninterrupted across longer sessions, not just short ones.'],
  ['Test in a browser without SpeechSynthesis support (or verify the code path), if feasible.', 'Voice DM control does not appear/crash — gracefully absent rather than broken.'],
])

// 15 ──────────────────────────────────────────────────────────────────────────
section('Session End & Character Progression', [
  ['Reach Session End after any solo session outcome.', 'Outcome banner, 7 stat tiles, and per-player XP/level rows are all populated correctly.'],
  ['End a session where a character crosses a level threshold.', 'A level-up modal presents skill/trait/stat upgrade choices; confirming one applies it and updates the character\'s level.'],
  ['End a session where a character has no eligible upgrades left.', 'Modal (or list) states no upgrades are available rather than showing an empty/broken picker.'],
  ['From Session End, click New Session, Hot Wash, Analytics, and Play Again in turn (separate runs).', 'Each button navigates/resets exactly as labeled: New Session returns Home and resets state; Hot Wash opens the report; Analytics opens your personal analytics; Play Again resets and returns to Scenario Select.'],
  ['Level a character up repeatedly across several sessions to reach the maximum level (XP ≥ 1500).', 'Progress bar and level badge correctly show "Max level reached" with no further level-up prompts.'],
])

// 16 ──────────────────────────────────────────────────────────────────────────
section('Hot Wash (After-Action) Report', [
  ['Open the Hot Wash report immediately after a session ends.', 'Report renders with performance metrics, a decision log with letter grades, and MITRE ATT&CK techniques encountered.'],
  ['Click "Generate AI Assessment".', 'A pulsing "reviewing…" status shows while loading, then a per-player letter-grade/feedback table appears; a "Regenerate assessment" link is offered afterward.'],
  ['Click "Generate Optimal Path" after the session has ended.', 'AI-derived ideal response sequence per act renders, with a "Regenerate optimal path" link available afterward.'],
  ['Open Hot Wash for a session that is still in progress (mid-session snapshot), if reachable.', 'A "Provisional Snapshot" badge is shown and "Generate Optimal Path" is hidden to avoid spoilers.'],
  ['Force an AI-generation failure (e.g. temporarily invalid API key) and click Generate AI Assessment.', 'Inline error message is shown rather than a silent failure or crash.'],
  ['Click "Print / Export PDF".', 'Browser print dialog opens with a print-friendly layout of the report.'],
  ['From Hot Wash, use "← Return to Session" (if session still active) or "← Back to Summary".', 'Navigates correctly back to the live session or the Session End summary as labeled.'],
])

// 17 ──────────────────────────────────────────────────────────────────────────
section('Personal Analytics', [
  ['Open Analytics with no session history yet.', '"No Session History Yet" empty state with a link back to DICE, no broken charts.'],
  ['Open Analytics after completing several sessions.', 'Four summary tiles, Recurring Skill Gaps, Watch Areas, Session History list, Scenario Coverage, and Character Progress table all populate with real data.'],
  ['Expand a Recurring Skill Gap row.', 'Shows the associated recommendation text.'],
  ['Download a session\'s PDF and JSON from the Session History list.', 'Both files download and contain that session\'s data.'],
  ['Click "⬇ Export CSV".', 'A CSV of your session history downloads and opens correctly in a spreadsheet app.'],
  ['Click "Clear history", then confirm.', 'Inline "Clear all history?" confirmation appears before any data is removed; confirming clears it and reloading shows the empty state again.'],
  ['Click "Clear history" and then Cancel instead of confirming.', 'No data is removed.'],
])

// 18 ──────────────────────────────────────────────────────────────────────────
section('Admin — Scenario Library', [
  ['As an admin, open Scenario Library and click "+ New Scenario".', 'Blank scenario editor opens with Basic Info, Kill Chain Stages, Acts, Threat Injects, and Critical Hit/Fail Inject sections.'],
  ['Add, reorder (↑/↓), and remove Kill Chain Stages.', 'Order updates live and persists on save.'],
  ['Add an Act with a Scene Seed, Primary Objective, and at least one Intelligence Clue with a MITRE ATT&CK technique reference.', 'Act saves correctly and displays its clue(s) with technique IDs.'],
  ['Add a Threat Inject with trigger type "Mandatory" and one with "DM Discretion".', 'Both save with their distinct trigger type preserved.'],
  ['Attach existing Critical Hit and Critical Fail catalog entries to the scenario.', 'Picker reflects entries from the Injects Catalog; selections persist with the scenario.'],
  ['Save a new global scenario.', 'It appears in Scenario Select for every user on the install (is_global), not just the admin.'],
  ['Edit an existing global scenario\'s victory/failure condition text and save.', 'Change is reflected immediately for all users without needing a rebuild.'],
  ['Delete a global scenario.', 'Confirmation reads "Delete this scenario for everyone on the install?"; after confirming, it disappears from every user\'s Scenario Select.'],
])

// 19 ──────────────────────────────────────────────────────────────────────────
section('Admin — Injects Catalog', [
  ['Open Injects Catalog and add a new Critical Hit inject entry.', 'New row accepts Description, "Advance attacker one kill-chain stage" checkbox, optional Add/Remove Complication text, optional NPC involvement fields, and optional temporary-effect fields.'],
  ['Check "Involves an NPC" on an entry.', 'NPC role select, Trust Delta number, "New Fact They Learn," and "Force Introduced" checkbox all appear.'],
  ['Check "Grants a temporary effect" on an entry.', 'Effect Description and "Lasts (rounds)" fields appear.'],
  ['Add a Critical Fail entry with different values, then click "Save Changes".', 'Both new entries persist; reloading the page shows them unchanged.'],
  ['Attempt to delete a catalog entry that is referenced by an existing scenario.', 'Confirmation explicitly warns it "removes it from any scenario that references it" before deleting.'],
  ['Confirm the deletion.', 'Entry is removed from the catalog and no longer selectable from the Scenario Library\'s inject picker.'],
])

// 20 ──────────────────────────────────────────────────────────────────────────
section('Admin — Program Analytics', [
  ['As an admin, open Admin Analytics.', 'Header reads "Program Analytics — All Users"; four summary tiles aggregate every user\'s sessions on the install.'],
  ['Set an Exercise Cadence target (days) and save.', 'Value persists server-side and is reflected in the cadence table\'s status calculations on reload.'],
  ['Review the cadence table for users with no sessions, overdue sessions, and recently-active sessions.', 'Status badges correctly read Never exercised / Overdue / Due soon / On track per user, and an "N users overdue" summary is accurate.'],
  ['Review Program-Wide Recurring Gaps.', 'Only shows gaps that recur 2+ times across the whole team, not single-user occurrences.'],
  ['Click "⬇ Export Program CSV".', 'Downloads a CSV covering all users\' session data, distinct from a single user\'s personal export.'],
  ['Confirm a Player-role account cannot reach /admin/analytics directly by URL.', 'Redirected away — program-wide analytics are admin-only.'],
])

// 21 ──────────────────────────────────────────────────────────────────────────
section('LAN Hosting & Network Behavior', [
  ['Launch DICE normally (default shortcut) and, from another device on the same network, browse to the host\'s LAN IP and port.', 'Connection fails/times out — default launch binds to localhost only.'],
  ['Close DICE and relaunch using the "DICE (LAN Host)" shortcut.', 'Windows Firewall may prompt to allow access on Private networks the first time — allowing it lets other devices connect.'],
  ['From a second device on the same trusted network, browse to http://<host-LAN-IP>:3001 and sign in.', 'App loads and functions normally from the second device using an account the admin created for them.'],
  ['Use the Lobby\'s QR code / shareable join link (if generated) from a phone on the same network.', 'Scanning/opening it lands directly on the Join screen pre-filled with the room code.'],
  ['Confirm the app is never reachable from outside the local network (no port-forwarding configured).', 'Cannot be reached from a device outside the LAN — matches the documented "trusted LAN only" design.'],
])

// 22 ──────────────────────────────────────────────────────────────────────────
section('Data Persistence, Backup & Uninstall', [
  ['Create characters, campaigns, and complete a session as one user; create a separate account and repeat.', 'Each user\'s roster/campaigns/history are private to them and not visible to the other user.'],
  ['Import a content pack (shared/install-wide content).', 'Visible identically to every user on the install, unlike personal roster/campaign data.'],
  ['Close DICE, copy %LOCALAPPDATA%\\DICE\\dice.db elsewhere as a backup, then make further changes in the app.', 'Backup file is a valid standalone copy usable for restoration testing.'],
  ['Restore the backed-up dice.db over the current one (DICE closed) and relaunch.', 'App reflects the state at backup time, including all users and their data.'],
  ['Update DICE by running a newer DICE-Setup.exe over the existing install.', 'All accounts and per-user data in %LOCALAPPDATA%\\DICE are preserved after the update; any new database migrations apply automatically on first launch.'],
  ['Uninstall DICE via "Add or remove programs".', 'Application files are removed; %LOCALAPPDATA%\\DICE (user data) is intentionally left in place.'],
  ['Reinstall DICE after an uninstall (without deleting %LOCALAPPDATA%\\DICE).', 'Existing accounts and data are recognized — no forced first-run setup.'],
  ['Manually delete %LOCALAPPDATA%\\DICE and relaunch.', 'Full reset — first-run Setup screen appears again as if freshly installed.'],
])

// 23 ──────────────────────────────────────────────────────────────────────────
section('Non-Functional & Cross-Browser Checks', [
  ['Load and exercise core flows (sign-in, roster, a short session) in Edge, Chrome, and Firefox.', 'Consistent layout and functionality across all three supported browsers.'],
  ['Resize the browser window narrower (tablet-ish width) on a content-heavy page.', 'Layout degrades gracefully — no unusable horizontal scroll or overlapping controls on the pages that support it; note any that don\'t.'],
  ['Open browser DevTools console while exercising every major page in this checklist.', 'No uncaught JavaScript errors logged during normal use.'],
  ['Run a full game session end-to-end and note total load/response times for DM turns.', 'DM responses return in a reasonable time (provider-dependent); no indefinite hangs without user feedback.'],
  ['Attempt SQL-injection-style or script-injection strings in free-text fields (character name, scenario text, chat/action text).', 'Input is stored/displayed literally (escaped) — no script execution, no database errors.'],
  ['Attempt to access another user\'s data by guessing/editing IDs in API requests (e.g. a character or campaign ID that isn\'t yours), using browser DevTools.', 'Server rejects with 403/404 — ownership scoping is enforced server-side, not just hidden in the UI.'],
])
