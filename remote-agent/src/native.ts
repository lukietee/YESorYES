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
