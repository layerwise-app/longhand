---
title: Boring Technology Is a Gift to Your Future Self
subtitle: What I learned about choosing tools from one payroll file, nineteen spare minutes, and a forum post that said "nvm."
description: A 3 a.m. payroll failure, the five commands that saved it, and what choosing boring technology actually buys the person holding the pager.
author: tomasz
topics: technology, work
cover_alt: A wall of plain beige bricks with one small green dot set among them
days_ago: 33
top_highlight: Every technology choice is a letter to whoever will be holding the pager, and that person is usually you, older and less patient.
---
At 3:12 in the morning on a Friday in February, a scheduler I had personally voted for stopped scheduling.

I was the on-call database person at Calloway Payroll, which moved paychecks for about 40,000 people. Every Friday the bank needed a file by 6:00 a.m. If the file was late, 40,000 people went to the grocery store that weekend with less money than they expected, and the phone would be answered by a woman named Bev who had done nothing to deserve it.

Eight months earlier we had replaced our cron jobs with a distributed workflow orchestrator. It was young and clever and had a lovely dashboard. There was a meeting. I compared features on a whiteboard with everyone else, and I raised my hand. Cron couldn't retry with exponential backoff or draw you a graph of your dependencies. Cron had also, as of that night, never once failed to start.

The dashboard was mostly green. The log said this, several times a second:

```text
ERR_QUORUM_EPOCH_STALE: refusing lease renewal (term 4471 < 4472)
```

I searched for that string. There was one result on the entire internet, a forum post fourteen months old. Someone had written, "Seeing this on three nodes, any ideas?" Underneath it, the same person, four days later: "nvm, fixed it."

Of the two engineers who understood the thing, one had left in November and the other was somewhere over the Pacific.

I tried what you try. I restarted a node. I restarted all of them, and the term numbers climbed faster. Around 4:40 I stopped trying to repair it and asked a different question: what does this job actually do? Once you peeled away the graph and the retries, it ran a SQL script against the payroll database and sent the result to the bank over SFTP. So I typed this into an editor with my coat still on over my pajamas.

```bash
#!/bin/bash
# payroll-file.sh: build the bank file and send it.
set -euo pipefail
out="/var/spool/payroll/ach-$(date +%F).txt"
psql "$PAYROLL_DB" -v ON_ERROR_STOP=1 -At -f build_ach.sql > "$out"
test -s "$out"
printf 'put %s\n' "$out" | sftp -b - bank-gateway
```

It stops at the first error and refuses to send an empty file. That's the whole feature list. The file reached the bank at 5:41. I sat in my kitchen eating cereal in the dark, feeling like a man who had gotten away with something.

On Monday we put that script in cron "temporarily." By summer the orchestrator was gone.

## What boring buys

I don't blame the orchestrator or its authors, who were smart and answered my eventual email graciously. I blame the meeting. We had compared what each option could do on a good day, and nobody asked what each would be like on its worst one.

When I say boring, I mean something specific: a great many people have run this thing for years and have failed with it in public. Here's what that pays for.

- **Your error message has been pasted before.** Somebody searched for it, somebody else answered, and that person wasn't guessing.
- **The failure modes have names.** Ask how an old relational database falls over and I'll tell you without looking anything up: disk full, connections exhausted, one long transaction holding back vacuum. You can write the runbook before the night arrives.
- **The new hire can carry the pager sooner.** Our orchestrator took about three months to learn well. Nobody has ever needed onboarding for five commands of shell.
- **Upgrades are dull.** You read the release notes, you test it on a copy, you go to lunch.
- **Your attention goes to what customers pay for.** We sold payroll. Nobody ever thanked us for our scheduler.

A caution, because I've watched people use this argument as an excuse. Old and boring are different things. The same company ran a file-transfer daemon from 1998, written in C by a man named Gustav, which nobody could compile anymore and which lived on a box we were afraid to reboot. It was the most exciting thing in the building. The test I use is whether a tired person who didn't write it can find out what it's doing, at night, without calling anyone. Gustav's daemon failed that test and cron passes it.

Some problems really do need the new thing, too. I've picked new things since and been glad. When you do, spend on it deliberately, the way you'd take out a loan, and work out who pays it back and when. Every technology choice is a letter to whoever will be holding the pager, and that person is usually you, older and less patient.

Last spring Nkechi, who used to sit across from me, sent a screenshot from the company chat. Calloway has been bought twice since my time. A young engineer had found `payroll-file.sh` still running in production, thirteen years old, and had looked up its history. He posted: "Who is teberling? Does anyone know how this works? Is it safe?"

Nkechi had replied: "No idea who that is. It has never paged anyone."

I've had performance reviews I liked less.

===responses===
@juniper: "Nobody asked what each would be like on its worst one" is going into our next tool evaluation as an actual line on the template. We've never once scored anything on how it fails.
  @imani: We started asking vendors to show us their worst error message during the demo. The silence is very informative.
@hollis: The forum post is too real. I have been the person who wrote "nvm, fixed it" and I think about it more than I should.
  @tomasz: If you can remember the fix, it's never too late to go back and post it. Somewhere a man is standing in his kitchen in a coat.
@saffron: I'm not technical at all but I run a small kitchen, and the distinction between old and boring holds up there too. The forty-year-old mixer everyone knows how to fix is a different animal from the antique oven only one guy understands.
