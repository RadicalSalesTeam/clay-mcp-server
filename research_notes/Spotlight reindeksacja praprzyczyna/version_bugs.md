# Version-specific Spotlight / Finder search indexing bugs (macOS 13 Ventura – 26 Tahoe, incl. 27 "Golden Gate"), as of Nov 2026

## Which macOS versions/point releases have documented Spotlight index corruption or decay bugs? Is any fixed in 15.x / 26.x updates?

### Takeaway
Every release from Ventura 13 to Tahoe 26 has well-documented Spotlight failures, but almost all evidence is user reports. Apple has published no release note saying it fixed "Spotlight forgets files" in any 13.x, 14.x, 15.x or 26.x update. Apple's only Spotlight index statement found is in **Tahoe 26.6** (July 2026): "optimizes the Spotlight index in preparation for macOS 27". The only confirmed fix of a long-standing indexing bug landed in **macOS 27.0 (Golden Gate)**, not in a 15.x or 26.x update.

### Cited Findings
**Ventura 13 (2022–23)**
- Apple Community thread "Spotlight Search not working on Mac after Ventura Update": indexing started at boot, then shut off for all volumes after a few minutes. The usual advice was `sudo mdutil -E /`. — [Apple Community 254348603](https://discussions.apple.com/thread/254348603)
- Ventura 13.5: one user reported that index data for a folder "seemed to be lost after about a week", leaving the folder unsearchable again. This is the closest Ventura match to the 10–14-day decay pattern. — [Apple Community 254785526](https://discussions-cn-prz.apple.com/thread/254785526)
- Ventura 13.x with Dropbox (File Provider): Spotlight did not link to Dropbox files. Rebuilds helped "for the first few minutes" or about a day, then the problem returned. — [Dropbox forum](https://community-origin.dropboxforum.com/discussions/101001016/spotlight-search-doesnt-link-to-files-in-dropbox-in-macos-13-ventura/633406/replies/649316); [Dropbox forum (≈1 day)](https://www.dropboxforum.com/discussions/101001016/spotlight-search-doesnt-link-to-files-in-dropbox-in-macos-13-ventura/633406/replies/642480)
- The "LG error" (RichText.mdimporter fails to index plain-text files beginning "LG", "NPA"/"HPA" or "Draw") is present from **macOS 13 onward** in Oakley's VM tests, and still present in **Tahoe 26.0.1**. Commenters saw it as early as Mojave and Catalina. — [Eclectic Light, 23 Oct 2025](https://eclecticlight.co/2025/10/23/a-spotlight-bug-affecting-all-recent-macos-the-lg-error/)

**Sonoma 14 (2023–24)**
- Sonoma 14.0 (build 23A344), Sept–Nov 2023, Apple Developer Forums thread (44+ replies, 52 participants):
  - Spotlight returned no apps, only web results, and Finder, Notes and System Settings searches failed.
  - Hazel, HoudahSpot and Alfred broke.
  - A reboot restored search briefly, then it failed again.
  - Users suspected network/AD-managed accounts and OneDrive.
  - One user said 14.1 fixed it and another said it persisted after 14.1.
  - No Apple engineer replied. — [Apple Developer Forums 738074](https://developer.apple.com/forums/thread/738074)
- A separate search summary says one Sonoma 14.1 commenter found the problem resolved after 14.1.1. This is anecdotal (seen on page 2/3 of the same forum thread). — [Apple Developer Forums 738074 p.3](https://developer.apple.com/forums/thread/738074?page=3)
- Sonoma 14.2: Finder Recents and Spotlight not working at all or not correctly. — [MacRumors](https://forums.macrumors.com/threads/recents-in-finder-and-spotlight-not-working-at-all-or-correctly-in-sonoma.2414063)
- Sonoma: a reader reported Mail and Calendar search failing on two Macs and working only briefly after minor updates. Oakley said this is a separate flavour of Spotlight (CoreSpotlight) for which he knows "essentially no fixes". — [Eclectic Light, 19 Nov 2024 (comments)](https://eclecticlight.co/2024/11/19/when-and-how-to-rebuild-spotlight-indexes/)
- Sonoma 14.7.4 users reported the same "mds_stores dies after indexing" bug as Sequoia 15.2 (Feb 2025). — [Apple Community 255886429](https://discussions.apple.com/thread/255886429)

**Sequoia 15 (2024–25)**
- **15.1** (Nov 2024): "Spotlight not finding apps since Sequoia upgrade – index rebuild temporary".
  - The original poster said a GUI rebuild held for **about a week**, then apps vanished again.
  - Others saw the problem persist on 15.2 (16 Dec 2024) and 15.3.1 (23 Feb 2025).
  - A community helper (Barney-15E) suspected "something is corrupting the index".
  - The thread closed with no fix version. — [Apple Community 255862819](https://discussions.apple.com/thread/255862819)
- 15.1: "Is there a more permanent fix for Spotlight Index not working". — [Apple Community 255860872](https://discussions-kr-prz.apple.com/thread/255860872)
- 15.1: Spotlight doesn't find some apps. — [Apple Community 255834181](https://origin-discussions2-us-dr-prz.apple.com/thread/255834181)
- **15.2** (Dec 2024): "Spotlight keeps dying after indexing" (M3 MacBook Pro).
  - mds_stores dies after indexing completes, and Spotlight then reports "No index" or "Spotlight server is disabled".
  - The failure came back about 15 minutes after a fix. After about a week of uptime it failed again, and `mdutil -i on /` held only for hours.
  - The original poster tied the crashes to an attached **Time Machine backup disk**, after backups finished. Others blamed flaky USB drives and cables.
  - Moving Time Machine to a NAS still left a failure "after about a week".
  - A bug report was filed with Apple on 16 Dec 2024. No later Sequoia fix was reported. — [Apple Community 255886429](https://discussions.apple.com/thread/255886429)
- **15.3–15.4+** (2025): "Spotlight indexing running wild".
  - corespotlightd wrote "TERRABYTES of data" to the SSD and System Data grew past 250 GB.
  - Spotlight stopped showing applications.
  - The problem "always seems to occur shortly after a time machine backup".
  - 15.4 did not fix it, and deleting the index didn't help one user. The only working fix reported was disabling SIP and unloading mds. — [Michael Tsai, 21 Jul 2025](https://mjtsai.com/blog/2025/07/21/spotlight-indexing-running-wild)
- Long thread "Continued corespotlightd process CPU overload issues" (Sequoia, 17+ pages). — [Apple Community 255894068](https://discussions-jp-prz.apple.com/en/thread/255894068?page=14)
- Sequoia: Spotlight withholds search results from Library folders (other than /Library/Application Support). `.metadata_never_index` no longer works. Searching SMB shares has "no reliable way" to be enabled. — [Eclectic Light summary, 29 Nov 2024](https://eclecticlight.co/2024/11/29/using-and-troubleshooting-spotlight-in-sequoia-summary/)
- **15.6**, reader report: on a mobile account with Secure Token, user files vanished from search after sleep or lock, and admin authentication or a restart restored them. Oakley suggested contacting Apple. — [Eclectic Light summary (comments)](https://eclecticlight.co/2024/11/29/using-and-troubleshooting-spotlight-in-sequoia-summary/)
- **15.1**, reader report: re-indexing the Data volume didn't fix missing PDFs, but `sudo mdutil -Eai off` / `on` did. Oakley suspected third-party interference. — [Eclectic Light summary (comments)](https://eclecticlight.co/2024/11/29/using-and-troubleshooting-spotlight-in-sequoia-summary/)
- Spotlight can no longer reliably search Time Machine backups in Sequoia or Tahoe, and Apple's own instructions are out of date (Oakley, July 2026). — [Michael Tsai, 9 Jul 2026](https://mjtsai.com/blog/2026/07/09/searching-time-machine-backups-and-versions/)

**Tahoe 26 (2025–26)**
- 26.0 / 26.0.1: Spotlight shows web results but no local files. Rebuilding the index sometimes doesn't help. The new "Apps" and "Files" sections returned no results. — [Apple Community 256149405](https://discussions.apple.com/thread/256149405); [Apple Community 256144332](https://discussions.apple.com/thread/256144332); [Apple Community 256140958](https://discussions.apple.com/thread/256140958); [Apple Community 256166507](https://origin-discussions2-us-dr-prz.apple.com/thread/256166507)
- TidBITS (Oct 2025):
  - Tahoe reset Spotlight settings.
  - Flexibits support "now believe it's a Tahoe bug".
  - Ron Risley said the problem predates Tahoe by years and that rebuilding "almost always fixed it (almost!)".
  - No 26.x fix was mentioned. — [TidBITS Talk](https://talk.tidbits.com/t/spotlight-in-os-26-not-indexing-all-files/32065)
- 26.1: some users said Spotlight was "finally okay" or "everything seems ok", while others still reported broken search on 26.1. — [MacRumors](https://forums.macrumors.com/threads/what-the-hell-is-up-with-spotlight.2469857); [Apple Community 256195748](https://discussions.apple.com/thread/256195748)
- 26.2 release notes (Apple developer notes and the public notes) contain no Spotlight fix. — [Apple macOS 26.2 release notes](https://developer.apple.com/documentation/macos-release-notes/macos-26_2-release-notes.md); [iClarified](https://www.iclarified.com/99355/macos-tahoe-262-release-notes)
- 26.3: a third-party (SEO-style) site claims "Spotlight returns only web results… known regression". This is unverified and not an Apple statement. — [macos-tahoe.com](https://macos-tahoe.com/blog/macos-tahoe-26-3-bugs-crashes-complete-fix-guide-march-2026/)
- 26.4.1 (May 2026), Oakley found new importer bugs:
  - RichText.mdimporter lets RTF Info metadata override xattrs (his "third bug" in that importer).
  - Image.mdimporter indexes EXIF UserComment into Comment.
  - `mdimport` crashes on JPEG and PNG screenshots, "a bug that has been long present".
  - Readers report plain-text `.sql` files disappearing from search since Tahoe. — [Eclectic Light, 6 May 2026](https://eclecticlight.co/2026/05/06/how-macos-can-ignore-and-hide-metadata/)
- Oakley (May 2026) expects the RichText bug will "never be fixed in Sequoia or Tahoe". He says a fix will require forcing index rebuilds on every volume, and that Intel Macs will be left with these bugs. — [Eclectic Light, 24 May 2026](https://eclecticlight.co/2026/05/24/last-week-on-my-mac-intel-macs-will-be-stuck-with-bugs/)
- **26.6** (July 2026) release notes: "optimizes the Spotlight index in preparation for macOS 27". — [Mr. Macintosh](https://mrmacintosh.com/macos-tahoe-26-6-update-everything-you-need-to-know/); [Eclectic Light, 20 Oct 2026](https://eclecticlight.co/2026/10/20/how-spotlight-indexes-in-golden-gate/)
- One search snippet said TidBITS quoted Apple as having "rearchitected the search index to be more stable, comprehensive, and responsive" around 26.6. I could not verify this because the TidBITS page returned 404, so treat it as unconfirmed. — [TidBITS Talk thread](https://talk.tidbits.com/t/os-26-6-delivers-massive-number-of-security-fixes/33890)

**macOS 27 Golden Gate (Sept 2026+)**
- Oakley: macOS 27.0 "fixed long-standing indexing bugs affecting some plain text files" (the LG-error family).
- In 27.0.1, indexing of new files was "both prompt and rapid" and similar to 15.6. — [Eclectic Light, 20 Oct 2026](https://eclecticlight.co/2026/10/20/how-spotlight-indexes-in-golden-gate/)

### Inferences
- I found no Apple-acknowledged fix in any 15.x or 26.x point release for "index works after rebuild, then degrades".
- Users' anecdotal "fixed in 14.1 / 26.1" claims conflict with other users' reports on the same versions. They likely reflect a reindex triggered by the update rather than a code fix.
- The 26.6 index "optimization" and the 27.0 importer fixes are the first Apple-side changes to index behaviour in this period.
- Because the importer bugs only matter after re-indexing, a fix in 27.x would need a full rebuild to take effect, per Oakley.

### Gaps
- I didn't check the full Apple security and release notes for 13.x, 14.x and 15.x for Spotlight-related CVE/bug items (for example, mds/mdworker security fixes that may change behaviour).
- I found no Apple engineer response in the Developer Forums threads.
- I couldn't retrieve the exact text of the 26.6 Apple notes beyond the "optimizes the Spotlight index" line.
- I have no data on whether Spotlight behaviour on 27.1 differs.

## Are there reports of a periodic pattern (works after rebuild, then fails after days/weeks)? What explanations are given?

### Takeaway
Yes, repeatedly. Reports of "a rebuild lasts about a week" exist for Ventura 13.5, Sequoia 15.1–15.3.1 (apps vanish from Spotlight) and Sequoia 15.2 / Sonoma 14.7.4 (mds_stores dies, recurs after about a week of uptime). The most concrete recurring trigger reported is Time Machine (attached or NAS backup disks, and corespotlightd write storms after backups). Other suspects are cloud File Provider apps (Dropbox, OneDrive, iCloud Optimize Storage), managed/AD/mobile accounts, buggy mdimporters, and unclean ejects of external volumes. No source documents an Apple "index rotation" that causes forgetting on a fixed schedule.

### Cited Findings
- About a week after a GUI rebuild, apps disappeared again (Sequoia 15.1 → 15.3.1). — [Apple Community 255862819](https://discussions.apple.com/thread/255862819)
- One user said the fix "fixed them both for about a week, now spotlight is not seeing applications again". Another said you must rebuild in Safe Mode with no apps running, "and even then, new items added to the index after the rebuild running in normal mode would be subject to the bug". The latter suggests a third-party trigger. — [Search snippets from Apple Community 255862819 / 255834181](https://origin-discussions2-us-dr-prz.apple.com/thread/255862819)
- mds_stores dies after indexing and again after about a week of uptime. The cause was traced to a Time Machine disk, and moving the backup to a NAS still failed after about a week (15.2 and Sonoma 14.7.4). — [Apple Community 255886429](https://discussions.apple.com/thread/255886429)
- corespotlightd write storms "shortly after a time machine backup". Reducing backup frequency lessened them. — [Michael Tsai](https://mjtsai.com/blog/2025/07/21/spotlight-indexing-running-wild)
- Ventura 13.5: index data "lost after about a week". — [Apple Community 254785526](https://discussions-cn-prz.apple.com/thread/254785526)
- Sonoma: a reboot restores search briefly, then it fails again. Network-managed accounts and OneDrive were suspected. — [Apple Developer Forums 738074](https://developer.apple.com/forums/thread/738074)
- Tahoe: "works after restart but degrades over time". Users reported fixes by force-quitting the Spotlight and `spotlightknowledged` processes, and by disabling "App Background Activity" login items (possibly Adobe). — [Apple Community 256140958](https://discussions.apple.com/thread/256140958); [Eclectic Light LG error comments](https://eclecticlight.co/2025/10/23/a-spotlight-bug-affecting-all-recent-macos-the-lg-error/)
- How index maintenance works (Oakley, Tahoe 26.2):
  - New and changed items go into transient posting tables and journals, which "periodically" are "assimilated into its more static tables".
  - Deleted items are removed only "when the store next undergoes housekeeping".
  - Maintenance runs mainly after login, or during light use on always-on Macs.
  - Sleep interrupts it, and "Disrupting Spotlight routine maintenance may affect search results".
  - Readers report results disappearing until a full reindex, and index files missing after kernel panics. — [Eclectic Light, 10 Feb 2026](https://eclecticlight.co/2026/02/10/in-the-background-spotlight-indexing/)
- Since Sonoma, mediaanalysisd and CGPDFService add Live Text and image analysis after standard indexing, which "may take many days to complete". — [Eclectic Light, 10 Feb 2026](https://eclecticlight.co/2026/02/10/in-the-background-spotlight-indexing/); [Eclectic Light Sequoia summary](https://eclecticlight.co/2024/11/29/using-and-troubleshooting-spotlight-in-sequoia-summary/)
- Tahoe/Sequoia indexes now include semantic vector embeddings (`_kMDItemPrimaryTextEmbedding`, vec_data) alongside kMDItemTextContent. — [Eclectic Light, 24 May 2026](https://eclecticlight.co/2026/05/24/last-week-on-my-mac-intel-macs-will-be-stuck-with-bugs/)
- Evicted iCloud files (Optimize Storage) are "inaccessible to Spotlight until they have been downloaded again". — [Eclectic Light Sequoia summary](https://eclecticlight.co/2024/11/29/using-and-troubleshooting-spotlight-in-sequoia-summary/); [Apple Community 254921112](https://discussions-jp-prz.apple.com/thread/254921112)
- Unclean or failed ejects of external disks leave ghost entries that only a rebuild clears. — [Eclectic Light, 19 Nov 2024 (comments)](https://eclecticlight.co/2024/11/19/when-and-how-to-rebuild-spotlight-indexes/)

### Inferences
- A 10–14-day failure cycle matches the "about a week" reports in Sequoia 15.1–15.3 and 15.2. The plausible mechanisms are:
  - a recurring trigger that re-corrupts or kills the store after a rebuild, such as a Time Machine backup cycle, an external or backup disk event, a File Provider sync, or a faulty importer re-encountering a bad file;
  - interrupted housekeeping (frequent sleep) that leaves journals unassimilated.
- None of these is a documented Apple design that "forgets" files on a timer.
- The new semantic and embedding indexing (Apple Intelligence era, Sequoia/Tahoe) and the Tahoe Spotlight redesign add components (spotlightknowledged, mediaanalysisd, embeddings). This plausibly raises failure surface, but I found no source proving causation.

### Gaps
- I found no technical source explaining exactly why stores degrade after X days (no log-level root cause from Apple or Oakley for the "about a week" pattern).
- I found no confirmation that Apple Intelligence or semantic indexing causes decay. It is only speculation in forums.
- The Secure Token / mobile account sleep issue (15.6) is a single, unconfirmed report.

## What do experts say about root causes?

### Takeaway
Howard Oakley consistently says repeated rebuilds are the wrong reflex. He holds that most "missing results" come from exclusions, withheld results, iCloud eviction, third-party interference or buggy mdimporters (RichText, Image), and that only known corruption justifies a rebuild. Michael Tsai's blog documents the Sequoia corespotlightd write-storm and Time Machine search breakage. Forum regulars suspect an unidentified agent "corrupting the index", and Apple has not publicly acknowledged a decay bug.

### Cited Findings
- Oakley: "The only indication for rebuilding Spotlight indexes on a volume is when they are known to be damaged or corrupted." He says that "one of the worst things to do is to keep forcing reindexing", and that if a faulty file or importer caused the damage, it will recur after a rebuild unless that file is removed. — [Eclectic Light, 19 Nov 2024](https://eclecticlight.co/2024/11/19/when-and-how-to-rebuild-spotlight-indexes/)
- Oakley: importer crash problems "seem to have largely gone away in more recent versions". He adds that deeper image analysis makes indexing much heavier on large collections. — [Eclectic Light, 19 Nov 2024](https://eclecticlight.co/2024/11/19/when-and-how-to-rebuild-spotlight-indexes/)
- Oakley: indexes can hold correct data while Spotlight still withholds the item from results (Library folders, privacy rules). Core Spotlight (Mail and similar) operates separately and "independently of TCC privacy controls". — [Eclectic Light Sequoia summary](https://eclecticlight.co/2024/11/29/using-and-troubleshooting-spotlight-in-sequoia-summary/)
- Oakley: mdimporters should identify files by UTI, not by magic bytes, and calls the magic-byte approach "a serious mistake". The RichText bug has been "silently blocking the indexing" of random text files for "three years or more". — [Eclectic Light, 23 Oct 2025](https://eclecticlight.co/2025/10/23/a-spotlight-bug-affecting-all-recent-macos-the-lg-error/); [Eclectic Light, 24 May 2026](https://eclecticlight.co/2026/05/24/last-week-on-my-mac-intel-macs-will-be-stuck-with-bugs/)
- Oakley on historical precedent: an RTF content-indexing bug in Catalina 10.15.6 persisted until Big Sur 11.3, and fixing it required rebuilding indexes. — [Eclectic Light, 23 Oct 2025](https://eclecticlight.co/2025/10/23/a-spotlight-bug-affecting-all-recent-macos-the-lg-error/)
- Oakley is sceptical that Spotlight itself is to blame when third-party background items break search on Tahoe. — [Eclectic Light, 23 Oct 2025 (comments)](https://eclecticlight.co/2025/10/23/a-spotlight-bug-affecting-all-recent-macos-the-lg-error/)
- Oakley's diagnostics:
  - `mdimport -L`, `mdimport -t -d3 <file>`, `mddiagnose -f <path>` and `mdutil -sa`;
  - his SpotTest app (macOS 14.6+);
  - checking for the kMDItemTextContent and `_kMDItemPrimaryTextEmbedding` attributes with `mdls`. — [Eclectic Light Sequoia summary](https://eclecticlight.co/2024/11/29/using-and-troubleshooting-spotlight-in-sequoia-summary/); [Eclectic Light, 24 May 2026](https://eclecticlight.co/2026/05/24/last-week-on-my-mac-intel-macs-will-be-stuck-with-bugs/)
- Michael Tsai collects Sequoia reports that point to Time Machine and corespotlightd. Some say deleting `/.Spotlight-V100` and `~/Library/Metadata/CoreSpotlight` works better than `mdutil -E`. — [Michael Tsai, 21 Jul 2025](https://mjtsai.com/blog/2025/07/21/spotlight-indexing-running-wild)
- Apple Community helper Barney-15E: "something is corrupting the index". No Apple acknowledgment followed in the thread. — [Apple Community 255862819](https://discussions.apple.com/thread/255862819)
- The Apple Support Community is now read-only and will permanently close on 20 Nov 2026, so the thread citations above may become archival. — [Apple Community 255886429](https://discussions.apple.com/thread/255886429)

### Inferences
- The expert consensus, mainly Oakley, points away from "the OS index naturally decays" and toward a persistent environmental trigger. It holds that recurrent rebuilding treats the symptom.
- For a 10–14-day cycle, the checks this evidence supports are:
  - Time Machine or external disk events and unclean ejects;
  - File Provider cloud apps;
  - managed or mobile account sleep/lock behaviour;
  - third-party background items or importers;
  - mds_stores crash logs in `log show --predicate 'process == "mds_stores"'`.

### Gaps
- I found no Apple statement, Feedback response or Knowledge Base article acknowledging an index-decay bug in 13–26.
- I did not search Reddit r/MacOS directly, so its reports are not covered here.
- I found no TidBITS editorial (Engst) analysis of root cause, only forum posts.
