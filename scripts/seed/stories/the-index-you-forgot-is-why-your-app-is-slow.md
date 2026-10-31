---
title: The Index You Forgot Is Why Your App Is Slow
subtitle: A rewrite was on the table until we looked at one query and the order of three columns.
description: A retired database engineer walks through a slow query, a misleading fix, and why column order decides whether a composite index helps.
author: tomasz
topics: technology
cover_alt: A dark grid of hundreds of blue squares with one small orange square standing out
days_ago: 6
top_highlight: An index is a sorted copy of part of your table, and everything about it follows from the word sorted.
---
The man on the phone had been told by three consultants that he needed to rewrite his application, and he wanted me to tell him which language to rewrite it in.

I'm retired, so I asked the question retired people get to ask: could I see the slow page first? He runs Brackett Supply, which sells kitchen equipment to a few thousand restaurants and bakeries, and the page listed a customer's open invoices. It took four seconds for some customers and was instant for others. His support team kept a sticky note on a monitor that read "Hartwell: tell them to refresh."

Slow for some and fast for others is a gift. It means the trouble lives in the data rather than the hardware.

## The query

Renata, his one developer, pulled it from the logs.

```sql
SELECT id, number, total_cents, created_at
FROM invoices
WHERE account_id = 48213
  AND status = 'open'
ORDER BY created_at DESC
LIMIT 25;
```

The table had 38 million rows and gained about 80,000 a day. It had an index on `created_at`, another on `status`, and the primary key. So the query was "indexed," Renata told me, a little defensively. We put `EXPLAIN (ANALYZE, BUFFERS)` in front of it with Hartwell's account number.

```text
Limit  (cost=0.56..1893.45 rows=25 width=48) (actual time=4102.771..4318.206 rows=25 loops=1)
  Buffers: shared hit=61204 read=187339
  ->  Index Scan Backward using invoices_created_at_idx on invoices  (cost=0.56..2914377.09 rows=38491 width=48) (actual time=4102.769..4318.181 rows=25 loops=1)
        Filter: ((account_id = 48213) AND (status = 'open'::text))
        Rows Removed by Filter: 6120418
Planning Time: 0.214 ms
Execution Time: 4318.260 ms
```

The planner chose to walk the date index backward from the newest invoice, fetch each row, and check whether it happened to be Hartwell's and open. `Rows Removed by Filter` is the number to stare at. It read 6.1 million rows and threw them away to return 25.

The choice wasn't crazy. It estimated 38,491 matching rows, assumed they were sprinkled evenly through time, and concluded it would collect 25 of them within roughly 25,000 rows. For a customer who orders every day, that's about right. But Hartwell had stopped ordering eleven weeks earlier and was disputing a stack of 412 old invoices. Eleven weeks at 80,000 a day is your six million. The better the customer, the faster the page.

It was worse below 25. A customer with fewer open invoices than that sent the scan through the entire index, into the app's 30-second timeout. Those showed up in the logs as "network errors," and nobody had looked into them in two years.

## Three columns, wrong order

Renata had already written the obvious migration, an index on `(created_at, account_id, status)`. We tried it on a copy of the database and the query dropped to 1.1 seconds. That's the dangerous result, because you'd ship it.

An index is a sorted copy of part of your table, and everything about it follows from the word sorted. Sort by date first, and one customer's entries are scattered through the whole structure among everybody else's. Postgres could now check account and status inside the index without visiting the table, which is why it got faster. It was still reading six million index entries one at a time.

Picture a filing cabinet. Filed by date, then customer, you open every day's folder looking for Hartwell. Filed by customer, then status, then date, you walk to Hartwell, flip to the open section, and the 25 you want are sitting in front in the order you want them. You don't search or sort, and you stop after 25.

So the rule for a query like this: equality columns first, then the column you sort or range over. Among the equality columns, the order doesn't change this query. I put `account_id` first because the index can then also serve anything that asks for all of one account's invoices, which `status` first could not do efficiently. And put the range or sort column after the equalities, because once the index has to span a range of values in one column, the columns after it no longer sit in one tidy sorted run.

```sql
CREATE INDEX CONCURRENTLY invoices_account_status_created_idx
  ON invoices (account_id, status, created_at DESC);
```

`CONCURRENTLY` keeps writes flowing during the build. It can't run inside a transaction, which some migration tools wrap around you by default, and if it fails it leaves an invalid index that you have to drop yourself. This one took 19 minutes.

```text
Limit  (cost=0.56..29.84 rows=25 width=48) (actual time=0.041..0.098 rows=25 loops=1)
  Buffers: shared hit=31
  ->  Index Scan using invoices_account_status_created_idx on invoices  (cost=0.56..45078.11 rows=38491 width=48) (actual time=0.039..0.093 rows=25 loops=1)
        Index Cond: ((account_id = 48213) AND (status = 'open'::text))
Planning Time: 0.187 ms
Execution Time: 0.121 ms
```

Thirty-one buffers against a quarter of a million. Note the estimate is still wrong, still 38,491. It no longer matters.

## Then take one away

Every index gets paid for on every write, so while you're in there:

```sql
SELECT indexrelname, idx_scan,
       pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE relname = 'invoices'
ORDER BY idx_scan;
```

The `status` index had been used 11 times since the counters last reset and weighed 900 MB. We dropped it, after checking the read replica, because those counters are per server.

The rewrite budget went to a second developer, which Renata had been requesting for two years. A week later Hartwell's bookkeeper called support to report that the invoices page had stopped loading properly. It came up before she'd finished reaching for her coffee, so she assumed it was showing her an old copy.

===responses===
@imani: The "network errors" paragraph hurt. We have a dashboard panel of exactly those, and I just went and checked how many are really timeouts on one query.
  @tomasz: Let me know what you find. In my experience the answer is "most of them," and the query is older than the dashboard.
@dov: Worth adding that `created_at DESC` in the index isn't strictly required here, since a btree can be read backward. It matters when you mix directions, like sorting one column ascending and another descending.
  @tomasz: Correct, and thank you. I keep the DESC because it tells the next reader what the index is for.
@ottoline: I don't write SQL and I followed all of this because of the filing cabinet. Also I would like to know more about the bookkeeper.
