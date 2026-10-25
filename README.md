# app-competitor-scorecard

See how your iOS app stacks up against its App Store rivals in one table: rating, number of ratings, monthly downloads and monthly revenue, with the change since last month. Give it your app's store id and up to nine rivals; it makes one API call and prints Markdown, CSV or JSON, and it can post a short summary to Slack or Discord.

Node 18+, no dependencies. There is also a [browser version](https://fdarkaou.github.io/app-competitor-scorecard/) that renders a pasted response and never sends it anywhere.

```
| App | Developer | Rating | Ratings | Monthly downloads | MoM | Monthly revenue | MoM | Scored |
| --- | --- | ---: | ---: | --- | ---: | --- | ---: | --- |
| **Example Meal Planner** (you) | Example Labs | 4.6 | 8.1k | 18k–75k (mid 36k) | +20% | $9k–$45k (mid $21k) | -9% | 2026-10-24 |
| Example Calorie Counter | Sample Health Co | 4.8 | 152k | 210k–860k (mid 420k) | -9% | $300k–$1.3M (mid $640k) |  | 2026-10-24 |
| Example Grocery List | Demo Apps Ltd | 4.4 | 3.9k | 7k–29k (mid 14k) |  | under $5k |  | 2026-10-24 |
| Example Recipe Box | Demo Apps Ltd |  |  | unknown |  | unknown |  |  |
```

(Example data from `examples/compare.json`, not real apps.)

## Where the data comes from

The numbers come from [PeekPanda](https://peekpanda.com), an iOS competitor catalogue that keeps dated evidence for each app. The tool calls [`GET /v1/competitors/compare`](https://peekpanda.com/docs/compare-competitors) with 2 to 10 `storeIds`, your app first. Over MCP the same read is the `search_apps` tool with action `compare`. It only reads stored data and never starts a collection.

Downloads and revenue are PeekPanda estimates: worldwide monthly ranges (low, mid, high) scored nightly, or "under 5k" below the floor. They are not numbers reported by Apple or the developer. Read [how the estimates are computed](https://peekpanda.com/docs/how-estimates-are-computed) before you put them in a deck.

You need a PeekPanda account and an API key. Each run is one call against your plan's daily API and MCP allowance.

## Use it

```bash
git clone https://github.com/fdarkaou/app-competitor-scorecard && cd app-competitor-scorecard
export PEEKPANDA_TOKEN=...   # API key from Account → API keys. Keep it out of source control.

node cli.js 1000000001 1000000002 1000000003                 # your app first, then rivals
node cli.js 1000000001 1000000002 1000000003 --by revenue    # sort rivals by revenue
node cli.js 1000000001 1000000002 --format csv > scorecard.csv
node cli.js 1000000001 1000000002 --webhook "$SLACK_WEBHOOK_URL"   # Discord webhook URLs work too
```

Try it without an account on the bundled example:

```bash
node cli.js --file examples/compare.json
npm test
```

Options: `--by installs|revenue`, `--format md|csv|json`, `--webhook <url>`, `--file <path>`, `--tenancy`, `--api`. Run `node cli.js --help` for details.

## How to read it

- Your app always stays on the first row; rivals are sorted by the mid estimate, unknowns last.
- MoM compares this month's mid estimate with the one that held a month earlier. It is blank when either month is missing or below the floor.
- "unknown" means PeekPanda has no nightly score for that app. It is unknown, not zero.
- Store ids PeekPanda does not hold are listed under the table. You can [request an app](https://peekpanda.com/docs/request-an-app) to add it.
- Use the ranges for direction and scale, not for exact figures.

## Weekly post in GitHub Actions

`.github/workflows/weekly-scorecard.yml` is an example job that runs on Monday mornings, writes the table to the run summary and posts the summary to a webhook. Add `PEEKPANDA_TOKEN` and `SCORECARD_WEBHOOK_URL` as repository secrets, set the repository variable `ENABLE_SCORECARD` to `true`, and put your own store ids in the file.

## License

MIT
