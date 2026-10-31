---
title: I Read Every Postmortem We Ever Wrote
subtitle: Twelve years of outages looked strange one at a time and not at all strange stacked in a spreadsheet.
description: A retiring engineer reads 214 incident postmortems in a row and finds when outages really start, why action items die, and who held up the roof.
author: tomasz
topics: technology, work
cover_alt: Rows of small black tally marks with a cluster in the middle picked out in red
days_ago: 71
top_highlight: We had been scheduling our outages and then acting surprised when they kept their appointments.
---
In the last four months before I retired, nobody would give me anything important to do, which is how I came to read all 214 postmortems the company had ever written.

Kittredge Systems sells fare-collection software to regional transit agencies. When the ticket gates stop working, people are either stuck on a platform or riding for free, and a transit director calls someone who calls us. We started writing postmortems in 2011, after an outage that cost one client most of a Monday, and kept at it for twelve years. Each document was read closely for about a week by the people who had been on the call. Then it went into a wiki folder and, as far as I can tell, was never opened again.

I read about three a day with a spreadsheet beside me, recording when each incident began, what triggered it, how we found out, who showed up, and what we promised to do about it.

## The chart everyone could have predicted

Any on-call engineer at Kittredge would have told you that incidents come at night. I'd have told you that myself, and I have the stories. So I started with the hour of onset.

![A bar chart of incidents by hour of day, with low bars overnight and two tall clusters just after the morning and afternoon deploy times](fig:incident-chart "All 214 incidents by hour of onset. Our deploys went out at 10:00 and 14:00.")

Only 23 of the 214 began between midnight and 6 a.m. We remembered those because we'd been awake for them and furious. The real peaks sat right after our two deploy windows: 61 incidents started between 10 and noon, and 52 between 2 and 4. Add in configuration changes and migrations done at other hours, and 131 of the 214, or 61 percent, began within two hours of something we had changed on purpose.

I tried to be fair about it. Daytime is also when people use the system, so perhaps load explained the shape. It doesn't. Transit load peaks at the commutes, around 8 and 5, and the chart has no bump at either. During the holiday weeks when we froze deploys and the trains kept running, incidents dropped by about two-thirds. We had been scheduling our outages and then acting surprised when they kept their appointments.

## What else was in there

1. **Things with dates on them.** Thirty-eight incidents came down to something expiring: certificates, API keys, a license, a partner's password. Nineteen were certificates. One certificate took us down in 2015 and again in 2017, and the second postmortem's action item matches the first word for word, because somebody copied it over.
2. **"Human error" left and the humans stayed.** It was the stated root cause 47 times, until a vice president banned the phrase in 2018. "Process gap" then appeared 44 times. Read side by side, they describe the same afternoon: a tired person and a production prompt that looked exactly like the staging prompt.
3. **Alerts only went one direction.** Our action items added 212 alerts and removed 9. Customers told us about the problem before our monitoring did in 58 incidents, or 27 percent, and that rate was the same in the final three years as in the first three.
4. **Action items die by vocabulary.** We wrote 1,106 of them and closed 453, which is 41 percent. Items naming a specific change to a specific file or setting closed at 78 percent. Items beginning with "investigate" or "consider" closed at 12 percent. Nobody ever decided against those. They sat there until the people who cared had moved to other teams.
5. **One person was holding up the roof.** Ruth Odegaard appears in the timelines of 71 postmortems, usually as a line like "14:32 Ruth joined," followed by a fix within a quarter of an hour. She left in 2019 for a job closer to her mother. Median time to resolve went from 47 minutes to 81 over the following year and a half. No postmortem mentions her leaving, because her leaving never caused an incident. It only made all the others longer.

I shouldn't oversell the spreadsheet. It was one reader with opinions, coding documents whose authors got more careful as the years went on, and people tend to write down the names of colleagues they admire. Some of Ruth's 71 are surely that. I'd still bet my pension on the shape of it.

## What we did about it

I presented all this on a Thursday in the big conference room. It took forty minutes and people were very kind, which should have told me something.

Two things changed before I left. A young engineer named Paolo built a single calendar of everything at Kittredge that expires, with a person's name beside each date. It took him an afternoon. And the team split the two big deploy windows into smaller batches spread across the day, which I'm told has flattened the peaks. I no longer see the numbers, and that's the sort of thing people tell a retiree. Everything else on the list is, as far as I know, still on the list.

What I keep returning to is how sincere those documents were. Every one was written by someone honestly baffled, working late, trying to explain a rare and peculiar event to people who deserved an explanation. It took reading them in a row to see that we had been having about six incidents, over and over, for twelve years, with different hostnames.

Postmortem 31 is from the spring of 2013, a fare-capping bug in a coastal city. Near the bottom are its action items, most of them long dead. The last one reads: "Review past postmortems for recurring patterns. Owner: T. Eberling. Status: open."

I have no memory of agreeing to that. I closed it on my last afternoon, ten and a half years late, and under resolution I wrote "see spreadsheet."

===responses===
@imani: The vocabulary finding is going to change how I write action items starting today. I just searched our tracker for "investigate" and I'm not going to tell you the number.
  @tomasz: You don't have to tell me. I already know roughly what it is.
@hollis: Number five is the one that stays with me. Every team I've been on had a Ruth, and every one of them treated her as an ordinary fact of the building, like the plumbing.
@wren: A yard I worked at kept a logbook of every boat that came back with the same complaint. Nobody read it either, until the man who kept it died and his daughter brought it in. Same six problems for thirty years.
  @dov: Now I want the Port Alder edition of this essay.
