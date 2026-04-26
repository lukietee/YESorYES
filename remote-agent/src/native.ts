import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

/**
 * Drive macOS Messages.app via AppleScript UI scripting.
 *
 * Visible-by-design: opens the app, presses Cmd+N for a new conversation,
 * types the recipient's name (looked up via Contacts), tabs into the
 * message field, types the body letter-by-letter via System Events keystrokes,
 * and presses Return to send. The audience watches the whole sequence.
 *
 * Recipient can be a contact name, a phone number, or an iMessage email.
 * If it's a contact name, that contact must exist in the laptop's Contacts.
 */
export async function sendIMessage(opts: {
  recipient: string;
  body: string;
}): Promise<void> {
  const escapedRecipient = opts.recipient.replace(/"/g, '\\"');
  const escapedBody = opts.body.replace(/"/g, '\\"');

  const script = `
tell application "Messages"
  activate
end tell

delay 0.4

tell application "System Events"
  tell process "Messages"
    -- New message window
    keystroke "n" using {command down}
    delay 0.5

    -- Type recipient
    keystroke "${escapedRecipient}"
    delay 1.0

    -- Pick the first autocomplete suggestion
    key code 36 -- Return to confirm recipient
    delay 0.4

    -- Tab to the message body field
    key code 48 -- Tab
    delay 0.3

    -- Type the body
    keystroke "${escapedBody}"
    delay 0.4

    -- Send
    key code 36 -- Return
  end tell
end tell
`;

  await exec("osascript", ["-e", script]);
}

/**
 * Add a reminder to the default Reminders.app list.
 *
 * Uses the Reminders scripting dictionary (not UI scripting) so it just
 * works without typing — the reminder pops into the visible list. The
 * Reminders window is brought to the front so the audience can see it land.
 */
export async function addReminder(opts: {
  title: string;
  body?: string;
}): Promise<void> {
  const escapedTitle = opts.title.replace(/"/g, '\\"');
  const escapedBody = (opts.body ?? "").replace(/"/g, '\\"');

  const script = `
tell application "Reminders"
  activate
  set newReminder to make new reminder with properties {name:"${escapedTitle}", body:"${escapedBody}"}
end tell
`;

  await exec("osascript", ["-e", script]);
}

/**
 * Drive Microsoft Outlook on macOS to compose and send an email.
 *
 * Visible-by-design: opens Outlook, Cmd+N for new message, types recipient,
 * tabs through Subject and Body, then Cmd+Return to send. Audience watches
 * the whole thing happen.
 */
export async function sendOutlookEmail(opts: {
  to: string;
  subject: string;
  body: string;
}): Promise<void> {
  const escapedTo = opts.to.replace(/"/g, '\\"');
  const escapedSubject = opts.subject.replace(/"/g, '\\"');
  const escapedBody = opts.body.replace(/"/g, '\\"');

  const script = `
tell application "Microsoft Outlook"
  activate
end tell

delay 0.6

tell application "System Events"
  tell process "Microsoft Outlook"
    -- New message window
    keystroke "n" using {command down}
    delay 0.8

    -- Recipient
    keystroke "${escapedTo}"
    delay 0.4
    key code 36 -- Return to confirm address
    delay 0.3

    -- Tab to Subject field
    key code 48 -- Tab
    delay 0.2
    keystroke "${escapedSubject}"
    delay 0.3

    -- Tab into Body
    key code 48 -- Tab
    delay 0.2
    keystroke "${escapedBody}"
    delay 0.4

    -- Send: Cmd+Return
    keystroke return using {command down}
  end tell
end tell
`;

  await exec("osascript", ["-e", script]);
}
