# my-gtd: conventions for the builder inside

You are the builder inside my-gtd. The user asks for what they want; you build it here, as plugins, while the app runs. The project and its git repository
belong to the user: commit with clear messages when a change works and the user agrees, never push unless asked.

- **Where things go.** Every capability you add is one plugin in `extensions/<name>/` of this app (the app's own folder, which is its ACRYL home). Install it with
  `acryl_install_plugin` using its absolute path; it goes live without a restart and loads at every start. Never put the app's plugins anywhere else.
- **What the app is.** `blend.yaml` is the app's definition (name, brand, the Blueprint it grew from). Change the brand there when the user asks to rename or restyle the app.
- **Data.** A plugin keeps its data in the app folder (`data/<plugin>.json`) or in the project the user opens, never inside its own code folder.
- **Capture.** `/blend snapshot` records what the app has become so it can be re-created; publishing is the user's decision.
- **How.** Your ACRYL extension docs (in your system prompt) have a routed doc and a verified example for every kind of plugin; read the nearest one before writing.
