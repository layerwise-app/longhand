---
title: What Twelve Minutes Does to a City
subtitle: The arithmetic of waiting, and the morning a rider asked me where his schedule went
description: A transit planner explains headways, why average wait is half the gap between buses, how bunching ruins it, and what frequency changed in Calloway.
author: juniper
topics: cities, science
cover_alt: A clock face on a red background with a twelve-minute wedge shaded yellow
days_ago: 44
top_highlight: A frequent bus lets you stop thinking about the bus, and that turns out to be most of what people wanted from it.
---
The first complaint we got after Route 6 went from every thirty minutes to every twelve came from a man who wanted to know where his schedule was.

Mr. Abernathy had ridden the 6 for nineteen years and kept a printed timetable in his coat. When we rolled out the new service in 2023 we stopped printing departure times for that line. The sign at each stop now said EVERY 12 MINUTES, 6 AM TO 9 PM. He called my desk directly, which I don't encourage and have never managed to prevent. "How am I supposed to know when the bus comes?" I said he wasn't supposed to. He told me that was the most arrogant thing he had ever heard from a public employee, and I have been to enough public meetings to know how stiff the competition is.

He had a point. I was asking him to give up something he had mastered.

## The arithmetic of standing there

The time between buses is called the headway. If buses are evenly spaced and you show up without looking anything up, you are equally likely to land anywhere in the gap. Arrive just after a bus pulls out and you wait the full headway. Arrive just before one pulls in and you wait nothing. Averaged over everybody, the wait comes to half the headway. Twelve minutes between buses means six minutes at the stop. Thirty means fifteen.

The slider below sends simulated riders to a stop at random moments and reports how long they waited on average.

{{embed:/embeds/headway.html|Change the headway, watch the wait}}

Drag it from 30 down to 12 and the average follows. Drag it up to 60 and it will tell you thirty minutes, and here I have to confess the model flatters the math, because at sixty minutes nobody arrives at random. They look up the time and plan around it, and the real cost moves somewhere no chart of stop waits will find it.

Take Delphine Ross, who works in the laundry at the hospital and clocks in at 7:00. Under the old schedule the 6:12 got her there at 6:38. The 6:42 got her there at 7:08, which is late. So every weekday she took the 6:12 and sat in a break room for 22 unpaid minutes, 110 minutes a week, for years. Our surveys of waiting at bus stops never caught any of it, because she wasn't at the bus stop.

## Why three come at once

Every rider has a theory about bunching, and most of the theories involve the drivers having lunch together. The real mechanism is meaner. Say a bus falls two minutes behind. More people have piled up at the next stop, so boarding takes longer, so it falls further behind, so even more people are waiting at the stop after that. The bus behind it finds every stop picked clean, boards almost nobody, and gains. Give them a long enough route and they run nose to tail, the first one packed and furious and the second one nearly empty. The instability comes standard.

It also hurts more than you would guess, because a random rider is far more likely to land in a long gap than a short one. The general formula, with two buses per 24 minutes spaced two ways:

```text
average wait = sum of (each gap squared) / (2 x total time)

even:     gaps of 12 and 12 min -> (144 + 144) / 48 =  6.0 min
bunched:  gaps of 2 and 22 min  -> (4 + 484) / 48    = 10.2 min
```

Same buses, same mileage, about 70 percent more waiting. So now a dispatcher watches the gaps instead of the clock, and when a bus is crowding the one ahead, we hold it for a minute or two at Ash and Fourth. Operators hate this. Luis, ten years on the 6, says passengers ask why they aren't moving, and "because the bus ahead of us needs a head start" has never once calmed anybody down.

## What it cost

The number of buses a route needs is its round-trip time divided by the headway. The 6 takes an hour there and back, counting layover, so a thirty-minute headway takes two buses and a twelve-minute headway takes five. Three extra buses, about sixteen hours a day, nearly every day of the year, at around $120 an hour, comes to a little over $2 million annually.

At the budget hearing a commissioner told me he had personally seen those buses half empty, and now I wanted three more of them. I said they were half empty because they came every half hour. This did not go over as well as it does in my head. It passed 5 to 4.

We didn't speed up the bus. Same stops, same 26 minutes end to end. Ridership rose 31 percent in eighteen months anyway, and the biggest jumps were midday and evening, the trips nobody plans a week ahead: lunch across town, the pharmacy after work, leaving a party when you actually feel like leaving. Riders tend to count a minute of waiting as worth about two minutes on the bus, which explains part of it. A frequent bus lets you stop thinking about the bus, and that turns out to be most of what people wanted from it.

Delphine takes the 6:24 now and gets in at 6:50. That's twelve minutes back, every morning. I asked what she does with them, and she said she drinks her coffee at her kitchen table, sitting down, like a person.

Mr. Abernathy mailed me his old timetable this spring, laminated, addressed to Transit Lady. The sticky note on it said: "Don't need this. Bus was 4 min late Tuesday."

There has been no timetable on that line for three years. I have no idea what he's measuring against, and I am not going to ask.

===responses===
@dov: I'd only ever heard "half the headway" stated, never seen why bunching makes it so much worse. The squared gaps are the part that clicked for me, since long gaps count twice over.
  @juniper: Exactly. Long gaps have more people in them and each of those people waits longer. Double penalty, and nobody voted for it.
@imani: Delphine's 22 unpaid minutes in the break room stayed with me. I've been that person with a different bus, and no one ever asked me about it because I was always early.
@tomasz: Does twelve hold up as the threshold, or was that just what your budget allowed? Our agency keeps saying fifteen is frequent.
  @juniper: Budget, honestly. Somewhere between ten and fifteen people stop checking, and I would take ten if a commissioner handed it to me.
@saffron: Now I want a typeface for that sign. EVERY 12 MINUTES deserves better than whatever your sign shop has been using.
