import ROOT_FOLDER from "@/observer/page/shared/rootFolder/index.js";

/** What a module folder is called on Home: the root module is the project itself, so it reads as the project's name. */
export default function moduleLabel({ folder, projectName }: { folder: string; projectName: string }): string {
	return folder === ROOT_FOLDER ? projectName : folder;
}
