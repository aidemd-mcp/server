---
name: brain
description: >
  General-purpose interface to the user's Obsidian vault. Reads the vault's
  root CLAUDE.md and follows its navigation instructions to find and return
  vault content relevant to the user's request — research, project context,
  environment, identity, references, or any other vault content. Use this
  skill for any vault query that is not specifically about coding conventions.
---

# /brain — Access Vault Knowledge

Read the user's Obsidian vault and return the content relevant to their request.

---

## Step 1: Read the Vault CLAUDE.md

Use the Obsidian MCP to read the vault's root CLAUDE.md.

This file contains all navigation intelligence for the vault — crawling
protocol, decision protocol, and a table of where to find different types
of content. Read it before doing anything else.

---

## Step 2: Follow the Navigation Instructions

Execute the navigation steps the vault CLAUDE.md provides to find the content
relevant to the user's request. Do not supplement, override, or paraphrase
the vault's navigation rules — defer to them entirely.

---

## Step 3: Fulfill the User's Request

Return what you found from the vault, synthesized in response to what the
user asked.

---

## Navigation Rules

- **Read the vault CLAUDE.md first.** Do not search, list directories, or
  read any other file before reading the vault's root CLAUDE.md.
- **Defer to the vault CLAUDE.md's navigation rules.** Do not supplement,
  override, or paraphrase them. The vault CLAUDE.md is the single source
  of truth for how this vault is organized.
