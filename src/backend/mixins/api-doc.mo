mixin () {
  public query func getApiDoc() : async Text {
    "# 余烬林：最后一炬 (Ember Forest: The Last Torch) — Backend API\n" #
    "\n" #
    "## Purpose\n" #
    "\n" #
    "The game is a client-side Phaser 3 browser game. All gameplay (gathering, crafting, campfires, survival stats, combat, day/night) runs in the browser, and saves live in the player's browser localStorage. The backend stores no game data and has no game-specific methods. An AI assistant has nothing game-related to call here; it only needs the generic methods below.\n" #
    "\n" #
    "## Public methods\n" #
    "\n" #
    "### Access control (role registry)\n" #
    "\n" #
    "- `_initialize_access_control() : async ()` (update). Registers the caller. The first non-anonymous principal to register becomes `admin`, and every later one becomes `user`. Anonymous callers are ignored (no error, no registration). Safe to repeat: an already registered caller keeps its role.\n" #
    "- `_internet_identity_sign_in_start() : async Blob` (update). Issues a challenge blob for Internet Identity attribute verification. The frontend sign-in flow uses it; direct API callers normally do not need it.\n" #
    "- `_internet_identity_sign_in_finish() : async Result<(), Error>` (update). Registers the caller (same rules as `_initialize_access_control`) and verifies the Internet Identity attribute bundle for the challenge issued by the start call. Returns `#ok` on success or `#err` with the verification error. No attributes are stored.\n" #
    "- `getCallerUserRole() : async UserRole` (query). Returns `#admin`, `#user` or `#guest`. Anonymous callers get `#guest`. A signed-in caller who never registered traps with \"User is not registered\".\n" #
    "- `isCallerAdmin() : async Bool` (query). True only for admins. An unregistered signed-in caller traps with \"User is not registered\".\n" #
    "- `assignCallerUserRole(user : Principal, role : UserRole) : async ()` (update). Admin only. Sets the role of `user`. A non-admin caller traps with \"Unauthorized: Only admins can assign user roles\". An unregistered caller traps with \"User is not registered\". Setting the same role again has the same result, so retrying is safe.\n" #
    "\n" #
    "`UserRole` is the variant `#admin | #user | #guest`.\n" #
    "\n" #
    "### Data query (OQL)\n" #
    "\n" #
    "- `schema() : async Text` (query). Returns a JSON description of the queryable tables the caller may read. Currently no tables are registered, so the document describes no entities.\n" #
    "- `execute(qJson : Text) : async Result` (query). Runs a JSON query against the registered tables. With no tables registered, every query refers to an unknown entity and returns an error or empty result. Do not expect game data from it.\n" #
    "\n" #
    "### Documentation\n" #
    "\n" #
    "- `getApiDoc() : async Text` (query). Returns this document.\n" #
    "\n" #
    "## Authentication and identity\n" #
    "\n" #
    "- The app's frontend uses Internet Identity. A caller is identified by its principal, which Internet Identity derives per app origin. The frontend pins a derivation origin (published at `/.well-known/ii-derivation-origin` when available). An agent that already holds the user's Internet Identity authorization must derive its principal against that origin (for example `icp identity link web <name> --app <host>`) to act as the same user. A principal derived against another origin is a different identity.\n" #
    "- Such a delegation acts with the user's full authority in this app until it expires. Treat it with care.\n" #
    "- Registration prerequisite: roles exist only after a call to `_initialize_access_control` or `_internet_identity_sign_in_finish` as a signed-in caller. The app's own frontend does this at sign-in. A principal that never signed in through the frontend, even one that belongs to the owner, is unregistered. Role queries from it trap with \"User is not registered\" until it registers. The first principal to register becomes admin, so the owner should sign in through the frontend first.\n" #
    "- Anonymous callers are always `#guest` and can never register.\n" #
    "\n" #
    "## Units and encodings\n" #
    "\n" #
    "- Principals are Candid `principal` values. `Blob` is raw bytes (`vec nat8`).\n" #
    "- No timestamps, amounts or optional fields appear in the public API.\n" #
    "\n" #
    "## Lifecycle, polling and retries\n" #
    "\n" #
    "- There are no long-running operations and nothing to poll. Every call completes in one request.\n" #
    "- Queries never change state. Registration and role assignment are idempotent, so repeating them is safe.\n" #
    "- `_internet_identity_sign_in_start` returns a new challenge each time. Use the challenge from the matching attempt when you finish sign-in.\n" #
    "\n" #
    "## Errors and gotchas\n" #
    "\n" #
    "- Authorization failures are canister traps (rejected calls with the messages quoted above), not `Result` variants. The only `Result` is `_internet_identity_sign_in_finish`.\n" #
    "- The game's saves are in the player's browser localStorage and cannot be read, written or backed up through this backend. Clearing browser data deletes them.\n" #
    "- This backend does not provide multiplayer, accounts for game progress, or any game state synchronization."
  };
};
