// Lets plain Node run the bot's TypeScript scripts with no extra packages:
// maps "@/..." to the web app's src/ and resolves extensionless imports to .ts.
import { register } from "node:module";

register("./resolve-hook.mjs", import.meta.url);
