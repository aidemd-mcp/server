import type { BrainSectionMarker, OutdatedSectionVersion } from "@/types/index.js";

/**
 * Every known outdated version of a bundled brain.aide template section,
 * recorded as the fingerprint of its normalized text (see `fingerprintSection`)
 * and a free-text `seenIn` label. The record holds fingerprints, not texts: the
 * detector only has to answer "is this section a known old version?", and the
 * offered `before` is always the user's own bytes.
 *
 * A section is stale only when its fingerprint is listed here and differs from
 * the current template's own fingerprint. A section that matches nothing here
 * is a customization and is never flagged.
 *
 * Whenever a template section's text changes, append its previous fingerprint
 * to the matching marker below (the drift pin in this module's test fails until
 * you do), then update that pin.
 */
const outdatedTemplateSections: Partial<Record<BrainSectionMarker, readonly OutdatedSectionVersion[]>> = {
	orientation: [
		{
			fingerprint: "c515892fef8c52346db03d53058fda024a0d18882445426c1ca10853faefbe71",
			seenIn: "v0.5.3–v0.9.0 (c0c7fa1–91ebd58)",
		},
		{
			fingerprint: "19dfe51a21f38ed8372971458a2c9cc8e801d4d967efed5e039df17c320443d9",
			seenIn: "unreleased d41c3c5",
		},
		{
			fingerprint: "681dfb7ef3345a69893e89b234bbb98e0a69fe37e86aa942d8b8c16a173ff8ee",
			seenIn: "unreleased 0831d94",
		},
		{
			fingerprint: "41fd066eac8d3249af5a1c935621d991d959dbe81843e4492754f9ba80527ae2",
			seenIn: "unreleased bbc3c40",
		},
	],
	config: [
		{
			fingerprint: "c5108dbe594ec4b2b1f7934c9ee1cf6ced4d9a47d126f5d23951a6b15cb37c48",
			seenIn: "unreleased c0c7fa1 (literal <BRAIN_PATH> marks the unwired slot)",
		},
		{
			fingerprint: "f37a7d89cb47e6c9574e7e9cdea07d978a81c4ae1bbf4c656c035e2d9ecba2d4",
			seenIn: "unreleased d064d37",
		},
		{
			fingerprint: "a5eda127c05487ec925e7a5c5f23b7027e5366b1f1d65cab8e1de896ede63d83",
			seenIn: "v0.5.3–v0.9.0 (effb254, 91ebd58)",
		},
		{
			fingerprint: "2e8ce5b7c0169489242db946d186701e984cecd6313074095207e1bfe1db8e24",
			seenIn: "unreleased d41c3c5",
		},
		{
			fingerprint: "0765b0e403b52186c790f97e92ea5b39d675ad38484ab0d35af35428b2921e4d",
			seenIn: "unreleased 0831d94",
		},
	],
	"update-playbook": [
		{
			fingerprint: "e2f18e8c574b50e7798db37ff2bba9a692e34ca1ecd97c1f6398480eff2403ff",
			seenIn: "unreleased c0c7fa1–effb254",
		},
	],
	"kanban-index": [
		{
			fingerprint: "15f06d709bde72c8ee9a1b72edd6e801de3f38b14f9bdeae43cec97ce7e5f527",
			seenIn: "unreleased 0831d94–bbc3c40",
		},
	],
	"kanban-create": [
		{
			fingerprint: "9b6c5503253926d50d30133ab0dc717ef8ac09570fd744a8a918de6437233a76",
			seenIn: "unreleased 0831d94–bbc3c40",
		},
	],
	"kanban-work": [
		{
			fingerprint: "23582e6aa8efaeb200435d8e41353001a83690148f2c775f7f7eb42ddb8d9f13",
			seenIn: "unreleased 0831d94–bbc3c40",
		},
	],
	"kanban-manage": [
		{
			fingerprint: "ff0c843fe5d32e644c5f4a349ba6240db2eeeacb595a22f2a530e80d31950ff0",
			seenIn: "unreleased 0831d94–bbc3c40",
		},
	],
	"kanban-move": [
		{
			fingerprint: "88e8d6daa526272926adb2df25a6fa37c886b1a547ed24b3411224991a26329a",
			seenIn: "unreleased 0831d94–bbc3c40",
		},
	],
	"kanban-complete": [
		{
			fingerprint: "3c4a3dc6d7dc28a4460c185e84f7b75ad5dc78e91df1f07c2ca94dfb3cfa1486",
			seenIn: "unreleased 0831d94–bbc3c40",
		},
	],
	"kanban-stash": [
		{
			fingerprint: "4bf93a47964d06478b4f45b3b92925caf4f44f5b5627b82d4b8d90735adef927",
			seenIn: "unreleased 0831d94–bbc3c40",
		},
	],
	"kanban-review": [
		{
			fingerprint: "77bdb15936c685fe0eff53945578df0f3f80f7eb4fa2c2a31157c459665f35ed",
			seenIn: "unreleased 0831d94–bbc3c40",
		},
	],
};

export default outdatedTemplateSections;
