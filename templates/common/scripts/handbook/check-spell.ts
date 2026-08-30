#!/usr/bin/env bun
// @version 1.0.0
// scripts/handbook/check-spell.ts
// L3 — Basic spell checker for English handbook HTML files.
// Validates visible text content against a built-in list of common
// misspellings without external spellcheck tools (no node-spellcheck,
// no hunspell, no dictionaries). Zero external dependencies.
//
// Checks:
//   1. Extracts visible text from English HTML files ( *_en.html )
//   2. Strips HTML tags, code blocks, URLs, and CSS
//   3. Matches against ~200 hardcoded common English misspellings
//   4. Reports potential typos with file and line number
//
// Vendored between intro-to-ai-harness and multi-agent-harness-handbook.
//
// Usage:
//   bun run scripts/check-spell.ts --docs-dir docs
// Exit code 0 if no typos, 1 otherwise.

import { findAllHtmlFiles, readFile, getDocsDir, configureDocsDir } from "./nav-utils.ts";
import { relative } from "node:path";

// ---------------------------------------------------------------------------
// Common misspellings dictionary: [ misspelling, correction ] tuples
// Using an array of tuples avoids duplicate-key issues with object literals.
// ---------------------------------------------------------------------------

const MISSPELLINGS: [string, string][] = [
  // a-b
  ["abandonned", "abandoned"],
  ["abberation", "aberration"],
  ["absolutly", "absolutely"],
  ["accidentaly", "accidentally"],
  ["accomodate", "accommodate"],
  ["accomodation", "accommodation"],
  ["accross", "across"],
  ["acheive", "achieve"],
  ["achive", "achieve"],
  ["acquaintence", "acquaintance"],
  ["aquire", "acquire"],
  ["agianst", "against"],
  ["amature", "amateur"],
  ["amoung", "among"],
  ["annoint", "anoint"],
  ["apparant", "apparent"],
  ["arguement", "argument"],
  ["assasinate", "assassinate"],
  ["assasination", "assassination"],
  ["athiest", "atheist"],
  ["awfull", "awful"],
  // c-d
  ["calender", "calendar"],
  ["categorys", "categories"],
  ["cemetary", "cemetery"],
  ["changable", "changeable"],
  ["charactor", "character"],
  ["cheif", "chief"],
  ["collegue", "colleague"],
  ["comander", "commander"],
  ["commertial", "commercial"],
  ["commision", "commission"],
  ["committe", "committee"],
  ["comparision", "comparison"],
  ["compatability", "compatibility"],
  ["compatable", "compatible"],
  ["competant", "competent"],
  ["completly", "completely"],
  ["complience", "compliance"],
  ["concious", "conscious"],
  ["concensus", "consensus"],
  ["conteplate", "contemplate"],
  ["contraversy", "controversy"],
  ["controll", "control"],
  ["controled", "controlled"],
  ["cooly", "coolly"],
  ["curiousity", "curiosity"],
  ["definately", "definitely"],
  ["definetly", "definitely"],
  ["develope", "develop"],
  ["dilemna", "dilemma"],
  ["dissapoint", "disappoint"],
  ["dissapear", "disappear"],
  ["docuemnt", "document"],
  ["documnet", "document"],
  ["effectivly", "effectively"],
  ["embarras", "embarrass"],
  ["embarass", "embarrass"],
  ["enviroment", "environment"],
  ["environmant", "environment"],
  ["esential", "essential"],
  ["excellant", "excellent"],
  ["excercise", "exercise"],
  ["exersize", "exercise"],
  ["expirience", "experience"],
  ["expiriment", "experiment"],
  ["extention", "extension"],
  // f-i
  ["facinate", "fascinate"],
  ["fammiliar", "familiar"],
  ["firey", "fiery"],
  ["flourescent", "fluorescent"],
  ["foriegn", "foreign"],
  ["fourty", "forty"],
  ["freind", "friend"],
  ["fulfil", "fulfill"],
  ["gaurd", "guard"],
  ["geneology", "genealogy"],
  ["goverment", "government"],
  ["governer", "governor"],
  ["gratefull", "grateful"],
  ["garantee", "guarantee"],
  ["guidence", "guidance"],
  ["harrass", "harass"],
  ["heighth", "height"],
  ["hierachy", "hierarchy"],
  ["humerous", "humorous"],
  ["hygeine", "hygiene"],
  ["idear", "idea"],
  ["ignorence", "ignorance"],
  ["immediatly", "immediately"],
  ["independant", "independent"],
  ["independece", "independence"],
  ["innoculate", "inoculate"],
  ["insurence", "insurance"],
  ["inteligence", "intelligence"],
  ["intelligance", "intelligence"],
  ["interate", "iterate"],
  ["irresistable", "irresistible"],
  ["jewlery", "jewelry"],
  ["judgemant", "judgment"],
  ["judgement", "judgment"],
  ["kernal", "kernel"],
  ["knowlege", "knowledge"],
  ["labratory", "laboratory"],
  ["langauge", "language"],
  ["layed", "laid"],
  ["lesure", "leisure"],
  ["libary", "library"],
  ["liscense", "license"],
  ["maintenence", "maintenance"],
  ["manuever", "maneuver"],
  ["medival", "medieval"],
  ["millenium", "millennium"],
  ["minature", "miniature"],
  ["minumum", "minimum"],
  ["mischevous", "mischievous"],
  ["mispell", "misspell"],
  ["morgage", "mortgage"],
  ["mountian", "mountain"],
  // n-p
  ["neccessary", "necessary"],
  ["neice", "niece"],
  ["nieghbor", "neighbor"],
  ["noticable", "noticeable"],
  ["occassion", "occasion"],
  ["occured", "occurred"],
  ["occurence", "occurrence"],
  ["offical", "official"],
  ["oportunity", "opportunity"],
  ["optimisim", "optimism"],
  ["orientated", "oriented"],
  ["overun", "overrun"],
  ["paralel", "parallel"],
  ["parliment", "parliament"],
  ["passtime", "pastime"],
  ["persistant", "persistent"],
  ["personaly", "personally"],
  ["plagarism", "plagiarism"],
  ["posession", "possession"],
  ["potatos", "potatoes"],
  ["practicly", "practically"],
  ["preceed", "precede"],
  ["preceeding", "preceding"],
  ["privlege", "privilege"],
  ["profesional", "professional"],
  ["promiss", "promise"],
  ["pronounciation", "pronunciation"],
  ["publically", "publicly"],
  // q-s
  ["quater", "quarter"],
  ["questionaire", "questionnaire"],
  ["readible", "readable"],
  ["realy", "really"],
  ["recieve", "receive"],
  ["recomend", "recommend"],
  ["reccomend", "recommend"],
  ["recomendation", "recommendation"],
  ["relevent", "relevant"],
  ["religous", "religious"],
  ["repitition", "repetition"],
  ["reponse", "response"],
  ["restraunt", "restaurant"],
  ["rythm", "rhythm"],
  ["saftey", "safety"],
  ["satelite", "satellite"],
  ["secretery", "secretary"],
  ["seige", "siege"],
  ["sentance", "sentence"],
  ["seperate", "separate"],
  ["seperatly", "separately"],
  ["sieze", "seize"],
  ["similarily", "similarly"],
  ["speach", "speech"],
  ["strenght", "strength"],
  ["stuborn", "stubborn"],
  ["succesful", "successful"],
  ["succesfully", "successfully"],
  ["suprise", "surprise"],
  ["synchronise", "synchronize"],
  // t-z
  ["technolgy", "technology"],
  ["teh", "the"],
  ["temperment", "temperament"],
  ["tendancy", "tendency"],
  ["thier", "their"],
  ["thouroughly", "thoroughly"],
  ["threshhold", "threshold"],
  ["tommorow", "tomorrow"],
  ["tounge", "tongue"],
  ["truley", "truly"],
  ["twelth", "twelfth"],
  ["tyrany", "tyranny"],
  ["underate", "underrate"],
  ["unfortunatly", "unfortunately"],
  ["untill", "until"],
  ["usally", "usually"],
  ["vacume", "vacuum"],
  ["vegatable", "vegetable"],
  ["vehical", "vehicle"],
  ["visious", "vicious"],
  ["wierd", "weird"],
  ["wich", "which"],
  ["writting", "writing"],
  ["yourslef", "yourself"],
];

/** Map from lowercase misspelling -> correction for fast lookup. */
const MISSPELLING_MAP = new Map<string, string>();
for (const [wrong, right] of MISSPELLINGS) {
  MISSPELLING_MAP.set(wrong.toLowerCase(), right);
}

/** RegExp that matches any misspelling as a word boundary. */
const MISSPELLING_RE = new RegExp(
  `\\b(${MISSPELLINGS.map(([w]) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "gi",
);

// ---------------------------------------------------------------------------
// Issue types
// ---------------------------------------------------------------------------

export interface SpellingIssue {
  file: string;
  line: number;
  misspelling: string;
  correction: string;
}

// ---------------------------------------------------------------------------
// Text extraction
// ---------------------------------------------------------------------------

/**
 * Strip HTML tags, script/style blocks, code blocks, URLs, and CSS
 * to produce visible text suitable for spell checking.
 * Returns the cleaned text (preserving original line structure).
 */
function extractVisibleText(html: string): string {
  // Remove script and style blocks entirely
  let cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, "\n");
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, "\n");

  // Remove pre/code blocks (code content should not be spell-checked)
  cleaned = cleaned.replace(/<pre[\s\S]*?<\/pre>/gi, "\n");
  cleaned = cleaned.replace(/<code[\s\S]*?<\/code>/gi, " ");

  // Remove HTML tags, replacing with space to preserve word boundaries
  cleaned = cleaned.replace(/<[^>]*>/g, " ");

  // Remove URLs
  cleaned = cleaned.replace(/https?:\/\/[^\s<>"']+/gi, " ");

  // Remove CSS-like patterns (property: value;)
  cleaned = cleaned.replace(/[\w-]+\s*:\s*[^;\n]+;/g, " ");

  // Decode common HTML entities
  cleaned = cleaned.replace(/&amp;/g, "&");
  cleaned = cleaned.replace(/&lt;/g, "<");
  cleaned = cleaned.replace(/&gt;/g, ">");
  cleaned = cleaned.replace(/&quot;/g, '"');
  cleaned = cleaned.replace(/&#39;/g, "'");
  cleaned = cleaned.replace(/&nbsp;/g, " ");
  cleaned = cleaned.replace(/&#\d+;/g, " ");
  cleaned = cleaned.replace(/&\w+;/g, " ");

  return cleaned;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export function checkSpelling(): SpellingIssue[] {
  const all: SpellingIssue[] = [];
  const htmlFiles = findAllHtmlFiles();
  const docsDir = getDocsDir();

  for (const filePath of htmlFiles) {
    const relFile = relative(docsDir, filePath).replace(/\\/g, "/");

    // Only check English HTML files (ending in _en.html)
    if (!/_en\.html$/i.test(relFile)) continue;

    const html = readFile(filePath);
    const text = extractVisibleText(html);
    const lines = text.split("\n");

    // Check each line independently for line-accurate reporting
    for (let i = 0; i < lines.length; i++) {
      let m: RegExpExecArray | null;
      // Reset lastIndex since we reuse the regex across lines
      MISSPELLING_RE.lastIndex = 0;
      while ((m = MISSPELLING_RE.exec(lines[i])) !== null) {
        const misspelling = m[1];
        const correction = MISSPELLING_MAP.get(misspelling.toLowerCase());
        if (!correction) continue;
        all.push({
          file: relFile,
          line: i + 1,
          misspelling,
          correction,
        });
      }
    }
  }

  return all;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--docs-dir");
  if (idx !== -1 && args[idx + 1]) configureDocsDir(args[idx + 1]);

  const issues = checkSpelling();

  if (issues.length === 0) {
    console.log("check-spell: OK -- no potential typos found.");
    process.exit(0);
  }

  console.error(`check-spell: ${issues.length} potential typo(s) found:`);
  console.error("Potential typos:");
  for (const issue of issues) {
    console.error(
      `  ${issue.file}: line ${issue.line}: "${issue.misspelling}" (did you mean "${issue.correction}"?)`,
    );
  }
  process.exit(1);
}
