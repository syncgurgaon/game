// Time Capsule Prompts — displayed randomly on room create to inspire the pool of pics.
// No AI needed; curated for maximum party-vibe variety.
export const PROMPTS = [
  "A core memory that lives in your head rent-free",
  "An unhinged 3AM screenshot",
  "A fit you regret with every fiber",
  "That one blurry photo you refuse to delete",
  "The most cursed selfie on your camera roll",
  "A screenshot of a wildly wrong autocorrect",
  "A pet doing something suspiciously human",
  "The last meme you sent that made you cackle",
  "A drink you thought would be aesthetic",
  "Yourself doing something oddly specific in 2020",
  "The most chaotic pic from a group chat",
  "A haircut era you don't talk about",
  "The receipt from your worst online cart",
  "A childhood room / desk / shelf",
  "The moodiest window view you've ever taken",
  "A late-night snack you documented for no reason",
  "You + a friend making objectively bad decisions",
  "A birthday photo where you look questionable",
  "Something in your camera roll you can't explain",
  "A screenshot of a Notes-app apology",
  "A stranger's dog you photographed like a criminal",
  "A drawing / doodle from a boring meeting",
  "The most 'main character' pose you own",
  "A blur so bad it counts as abstract art",
  "That one holiday pic that aged terribly",
  "You mid-laugh, mid-chew, mid-sneeze — pick chaos",
  "A pic of you in someone else's clothes",
  "The plate of food you were most proud of",
  "A sunrise or sunset only you saw",
  "The wildest fit-check from your Uni years",
  "A screenshot of a lie you told a group chat",
  "A photo you took by accident that slaps",
  "You with a haircut that felt right at the time",
  "The angriest text you screenshotted for evidence",
  "Yourself trying a trend that didn't work",
  "A whiteboard drawing you're weirdly proud of",
  "The messiest room / desk you've ever loved",
];

export function randomPrompt(exclude = "") {
  let p = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
  if (p === exclude && PROMPTS.length > 1) {
    p = PROMPTS[(PROMPTS.indexOf(p) + 1) % PROMPTS.length];
  }
  return p;
}
