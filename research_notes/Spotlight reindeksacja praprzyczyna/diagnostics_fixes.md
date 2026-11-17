# Diagnosing a recurrently breaking macOS Spotlight index: command-level playbook and durable fixes (macOS 13–26)

Scope note: 15 tool calls were used. Primary sources fetched: Howard Oakley / eclecticlight.co (2021, 2023, Nov 2024 x2, Nov 2025), the current Xcode-shipped man pages for mdutil / mddiagnose / mdimport (keith.github.io mirror), Apple Support 102321, TidBITS Talk threads, and Apple Community threads (search snippets only). Apple Support pages for Safe Mode, First Aid and reinstall were NOT fetched this session. Items marked "(not fetched)" or "(inference)" need verification by the report writer.

## 1. Exact commands and how to interpret them

### Takeaway
`mdutil -E` is NOT deprecated. It is still the documented "erase and rebuild" switch. `-X` is a separate, newer option that deletes the index directory without disabling indexing. The rebuild happens only on remount, reboot, or an explicit `mdutil -i`/`-E`. The best one-shot evidence collector is `sudo mddiagnose`. It gathers mds/mdworker crash and spin reports, the last file each mdworker indexed, the last file that crashed an mdworker, the per-volume config and exclusions, and logs. That makes it the key tool for finding the root cause of a recurring breakage.

### Cited Findings
**mdutil (current man page)**
- `-s` shows indexing status. `-a` applies to all volumes. `-v` is verbose. `-i on|off` sets indexing status, which "may be delayed by low disk space or other conditions." `-d` disables Spotlight searches on a volume. `-E` "erases each local store… rebuilt if appropriate." `-p` flushes locally cached network indexes. `-r plugins` asks the server to reimport files for the UTIs claimed by the listed plugins. `-L volume` lists the contents of the index directory. `-P volume` dumps `VolumeConfiguration.plist`. `-X volume` removes the Spotlight index directory but does not disable indexing; Spotlight re-evaluates the volume on remount, reboot, or explicit `mdutil -i` / `mdutil -E`. — [mdutil(1) man page (Xcode mirror)](https://keith.github.io/xcode-man-pages/mdutil.1.html)
- Older man-page copies (SS64, unix.com Mojave) lack `-X`, `-L`, `-P` and `-r`. Old guides written from them omit these options. — [SS64 mdutil](https://ss64.com/mac/mdutil.html); [TidBITS Talk search result](https://talk.tidbits.com/t/which-terminal-command-is-preferable-to-reindex-the-internal-ssd-mdutil-e-or-mdutil-x-followed-by-mdutil-i/20587)
- **No source found saying `-E` is deprecated in favor of `-X`.** The TidBITS (Monterey-era) consensus was that `-E` or the GUI privacy toggle is enough. Use `-X` then `-i on` only when you want the index directory physically removed. — [TidBITS Talk](https://talk.tidbits.com/t/which-terminal-command-is-preferable-to-reindex-the-internal-ssd-mdutil-e-or-mdutil-x-followed-by-mdutil-i/20587)
- Oakley (Nov 2024): `sudo mdutil -E /` erases the indexes on the Data volume and forces a rebuild. You do not need to turn indexing off first or delete `.Spotlight-V100`. There is "no need" for `-X` just to force a rebuild. If you use `-i off`, you must later run `-i on`, or Spotlight won't recreate the index. Commenters note that after `-X` you need `-i on`. — [Eclectic Light: When and how to rebuild Spotlight indexes](https://eclecticlight.co/2024/11/19/when-and-how-to-rebuild-spotlight-indexes/)
- Open question from that article: whether `/` covers `/System/Volumes/Data` (a reader claimed it doesn't). Oakley said he'd test it. Explicitly running `sudo mdutil -s /System/Volumes/Data` avoids the ambiguity (inference). — [Eclectic Light 2024-11-19](https://eclecticlight.co/2024/11/19/when-and-how-to-rebuild-spotlight-indexes/)

**mdimport**
- `mdimport -L` lists installed mdimporter plugins and their paths. `mdimport -t -d3 <file>` shows which importer handled a file and what it extracted. `-t` test-imports without storing to the index, and `-d level` requires `-t`. — [Eclectic Light: Sequoia summary](https://eclecticlight.co/2024/11/29/using-and-troubleshooting-spotlight-in-sequoia-summary/); [mdimport(1)](https://keith.github.io/xcode-man-pages/mdimport.1.html)
- Importer locations: system importers are in `/System/Library/Spotlight`. Third-party importers are in `/Library/Spotlight`, `~/Library/Spotlight`, or inside app bundles. — [Eclectic Light 2024-11-19](https://eclecticlight.co/2024/11/19/when-and-how-to-rebuild-spotlight-indexes/)
- Interpretation for finding faulty importers (inference): in the `mdimport -L` output, look for third-party or duplicate importers claiming common UTIs (PDF, Office, images). Run `mdimport -t -d3` on files that are missing from results. If the plugin reported is a third-party one, or the import errors or hangs, that importer is a suspect. `mdutil -r <plugin>` can then force a reimport of its UTIs after a fix.

**mddiagnose (key for root cause)**
- `sudo mddiagnose [-f path] [-m subset] [-p path]` collects the following: a spindump and top output; samples of mds and mdworker; all Spotlight DB paths; all system logs; spin and crash reports for mds and mdworker; recent query strings with result-quality stats; disk and network-share info; **the path of the last file indexed by each mdworker and the last file that caused an mdworker crash**; and the per-volume Spotlight config including **user-excluded paths**. It harvests no user data or credentials. `-p path` gathers permissions and filter info for a specific file (run as that file's owner). — [mddiagnose(8)](https://keith.github.io/xcode-man-pages/mddiagnose.8.html)
- Oakley lists `mddiagnose -f [path]` as "full Spotlight diagnostics." — [Eclectic Light Sequoia summary](https://eclecticlight.co/2024/11/29/using-and-troubleshooting-spotlight-in-sequoia-summary/)

**Index store, size, config**
- Each indexed volume has a hidden `.Spotlight-V100` folder at its root. It contains `VolumeConfiguration.plist` and `Store-V2/<UUID>/` with opaque index files. — [Eclectic Light 2024-11-19](https://eclecticlight.co/2024/11/19/when-and-how-to-rebuild-spotlight-indexes/)
- On the boot disk it is `/System/Volumes/Data/.Spotlight-V100`. Measure its size with `sudo du -sh` (one reader reported 52 GB). — [Eclectic Light 2025-11-20 comments](https://eclecticlight.co/2025/11/20/diagnose-spotlight-local-search-problems/)
- `sudo mdutil -P /System/Volumes/Data` dumps `VolumeConfiguration.plist`, which shows exclusions and store state, and `-L` lists the store contents. — [mdutil(1)](https://keith.github.io/xcode-man-pages/mdutil.1.html)

**Logs and processes**
- The processes to watch are `mds`, `mds_stores`, `mdworker` / `mdworker_shared` (several), and `mediaanalysisd` (Live Text and Visual Look Up content, indexed later). `corespotlightd` handles app-private Core Spotlight data. — [Eclectic Light 2024-11-29](https://eclecticlight.co/2024/11/29/using-and-troubleshooting-spotlight-in-sequoia-summary/); [Eclectic Light 2025-11-20](https://eclecticlight.co/2025/11/20/diagnose-spotlight-local-search-problems/) (corespotlightd is named in the 2025 article's comment thread in connection with Core Spotlight; the process name itself is an inference)
- Healthy indexing log line: an `mds_stores` message of the form "compressing N bytes to <private>". A healthy search shows "xpc checking in", then `directQueryOpenReply` / `QueryOpen` / `directQueryFetchResultsReply`. — [Eclectic Light 2021](https://eclecticlight.co/2021/02/19/spotlight-on-search-how-to-diagnose-and-fix-problems/); [Eclectic Light 2023](https://eclecticlight.co/2023/06/22/what-to-do-when-spotlight-cant-find-it/)
- Diagnostic rule: no indexing activity in the log after a file is created means an indexing failure. Prompt indexing but no results means a search failure. — [Eclectic Light 2025-11-20](https://eclecticlight.co/2025/11/20/diagnose-spotlight-local-search-problems/)
- Repeated crash and restart of an mdworker means a bug or a malformed file. Find and remove the file; a rebuild "will likely recur" otherwise. — [Eclectic Light 2024-11-19](https://eclecticlight.co/2024/11/19/when-and-how-to-rebuild-spotlight-indexes/); [Eclectic Light 2023](https://eclecticlight.co/2023/06/22/what-to-do-when-spotlight-cant-find-it/)
- Common log symptom: launchd lines "Service exited due to SIGKILL | sent by mds" for `com.apple.mdworker.shared`. These are symptoms and not causes on their own (mds kills workers that hang or exceed limits). — [Apple Community 252732670](https://discussions.apple.com/thread/252732670)
- Crash reports have names beginning "mds" or "mdworker" and ending ".crash" (modern macOS uses `.ips`, an inference). Look in `/Library/Logs/DiagnosticReports` and `~/Library/Logs/DiagnosticReports`, or Console › Crash Reports. — [Apple Community search result](https://discussions.apple.com/thread/6469804)
- No reliable source confirmed a `subsystem == "com.apple.spotlight"` predicate. Oakley warns that subsystems are inconsistently used, so filtering by **process** is safer. — [Eclectic Light: log predicates primer](https://eclecticlight.co/2016/10/17/log-a-primer-on-predicates)
- Suggested log commands (inference built from the documented log syntax and the process names above):
  - `log show --last 1h --style compact --predicate 'process IN {"mds","mds_stores","mdworker","mdworker_shared","corespotlightd"}'`
  - `log show --last 1d --predicate 'eventMessage CONTAINS[c] "mdworker" AND eventMessage CONTAINS[c] "SIGKILL"'`
  - `log stream --predicate 'process == "mds_stores"'` (live)
  - Oakley's Mints (Spotlight › Log Window) and LogUI do the same in a GUI. — [Eclectic Light 2025-11-20](https://eclecticlight.co/2025/11/20/diagnose-spotlight-local-search-problems/)

**Exclusions**
- `.noindex` suffix and dot-prefixed folders are excluded. An empty `.metadata_never_index` file no longer works. Spotlight settings have two lists: Search results, which hides items but still indexes them, and Search Privacy, which stops indexing. — [Eclectic Light 2024-11-29](https://eclecticlight.co/2024/11/29/using-and-troubleshooting-spotlight-in-sequoia-summary/)
- Sequoia withholds search results from `Library` folders, except `/Library/Application Support`. — same source
- `mdls <file>` verifies that metadata exists. Missing metadata means the folder wasn't indexed. — [Eclectic Light 2025-11-20](https://eclecticlight.co/2025/11/20/diagnose-spotlight-local-search-problems/)

### Inferences
- For a "breaks every ~2 weeks" pattern, run `sudo mddiagnose` *while broken*, and keep the archive. Its "last file that crashed mdworker" plus the crash and spin reports point most directly to a poison file or a faulty importer. Repeat the next time it breaks and compare.
- `mdutil -s -v` (or `-sav`) reporting "Indexing enabled" says nothing about index health. Only a canary search proves health.

### Gaps
- The exact behavior and help text of `mdutil` on macOS 26 Tahoe was not verified from an Apple-hosted page. Run `man mdutil` on the target Mac.
- Whether `fs_usage` and `sysdiagnose` add value beyond `mddiagnose` was not researched. `sysdiagnose` is known to bundle Spotlight data, but this was not verified.
- No authoritative source covered the `.Spotlight-V100` ownership and permissions expected on modern macOS.

## 2. Building a canary test to detect degradation and correlate with events

### Takeaway
Oakley's method is the model. Create known test files at a recorded time, search for them about 10 seconds later with both `mdfind` and NSMetadataQuery, and pull the log for that window. His free Mints and SpotTest apps automate this. A cron/launchd version is a straightforward adaptation (inference).

### Cited Findings
- Mints: "Create Test" at a known time creates files containing "syzygy999". After ≥10 s, "Check Search". Then view the log from the creation time for ~30 s. — [Eclectic Light 2023](https://eclecticlight.co/2023/06/22/what-to-do-when-spotlight-cant-find-it/)
- SpotTest (1.1+, Aug 2025): creates 14 test files (A–N) in `~/0_SpotTestFiles` with the term "cattle" and runs both NSMetadata and mdfind searches. Expected results: NSMetadata finds A–G, I, K–M (not H); mdfind finds A–G, H, I, K–M. H and I depend on Visual Look Up and Live Text via mediaanalysisd and may take from an hour to days. A "Check importers" button shows the importer per type. Grant Full Disk Access for protected locations. — [Eclectic Light 2025-11-20](https://eclecticlight.co/2025/11/20/diagnose-spotlight-local-search-problems/); [SpotTest 1.1](https://eclecticlight.co/2025/08/28/check-and-diagnose-spotlight-problems-with-spottest-1-1/)
- Third-party apps searching iCloud-managed Desktop and Documents can fail due to TCC and sandbox differences. Run canaries outside iCloud-managed folders, or grant Full Disk Access, to avoid false alarms. — [Eclectic Light 2025-11-20 comments](https://eclecticlight.co/2025/11/20/diagnose-spotlight-local-search-problems/)

### Inferences (proposed scripted canary — not from a source)
- A launchd agent runs hourly as follows:
  1. Write `~/SpotCanary/canary-$(date +%s).txt` containing a unique token such as `zqcanary<epoch>`.
  2. Sleep 60 s, then run `mdfind -onlyin ~/SpotCanary "zqcanary<epoch>"`.
  3. Also query a fixed old canary created at setup with `mdfind "zqcanaryPERMANENT"`. This detects index *loss*, as opposed to new-file indexing stalls.
  4. Append a timestamped PASS/FAIL line to a log file, along with `mdutil -s /System/Volumes/Data`, `sudo du -sk /System/Volumes/Data/.Spotlight-V100`, `sw_vers -productVersion`, and uptime.
  5. On the first FAIL, run `sudo mddiagnose -f ~/SpotCanary/diag-<epoch>`, or at least `log show --last 2h` filtered to the Spotlight processes.
- To correlate with events: `pmset -g log | grep -E "Sleep|Wake"` for sleep and wake, `log show --predicate 'process == "softwareupdated"'` or `/Library/Receipts/InstallHistory.plist` for updates, and `log show --predicate 'process == "diskarbitrationd"'` for mounts. Line these up against the first FAIL timestamp.
- Two distinct failure signatures: if the permanent canary disappears, the index was lost or reset. If only new canaries fail, indexing has stalled (an mdworker crash loop or a hung importer).

### Gaps
- Neither SpotTest nor Mints was confirmed to offer a scheduled or unattended mode. The scripted design above is unvalidated.

## 3. Durable fixes

### Takeaway
A rebuild is a symptom fix. Oakley says to rebuild only when the index is known to be damaged. If an mdworker crash loop on a specific file is the cause, the problem "will likely recur" until that file is removed or excluded, which fits a 2-week cycle. The durable path is to find the poison file or importer (mddiagnose, crash reports, `mdimport -t -d3`), exclude or remove it, verify the disk, and only then rebuild once. If it still recurs, isolate with Safe Mode and a new user, then reinstall macOS over the existing system and file Feedback.

### Cited Findings
- Apple's official rebuild: System Settings › Spotlight (or Siri & Spotlight) › Search Privacy (or Spotlight Privacy). Add the disk or folder, wait a few seconds, remove it, and quit Settings; "Spotlight now reindexes". If you get an "unknown"/permissions error, fix ownership. — [Apple Support 102321](https://support.apple.com/en-us/102321)
- Terminal equivalent: `sudo mdutil -E /` (or other volume paths). A rebuild of all volumes can take hours or days. Verify progress in Activity Monitor (mds_stores, mdworker, mds busy; mostly on E-cores on Apple silicon). The menu-bar progress bar only covers the initial phase. — [Eclectic Light 2024-11-19](https://eclecticlight.co/2024/11/19/when-and-how-to-rebuild-spotlight-indexes/)
- Do not rebuild when indexing is merely slow. Repeatedly forcing reindexing or disabling Spotlight is "one of the worst things to do", especially with large photo collections. If mdworker crashes on one file, identify and remove it. — [Eclectic Light 2024-11-19](https://eclecticlight.co/2024/11/19/when-and-how-to-rebuild-spotlight-indexes/)
- A stalled indexing volume that won't unmount: force-eject in Finder and restart, or shut down, disconnect, and restart. — [Eclectic Light 2024-11-29](https://eclecticlight.co/2024/11/29/using-and-troubleshooting-spotlight-in-sequoia-summary/)
- Check the basics first: Spotlight result categories (Files and Folders on), the Privacy list, correct file extensions (mdworker types files by extension), and Finder Find instead of the menu-bar UI. — [Eclectic Light 2023](https://eclecticlight.co/2023/06/22/what-to-do-when-spotlight-cant-find-it/)
- Apple Community (Sequoia) reports say erasing with `mdutil -E` *plus a reboot* was what worked. Others found rebuilds only temporary ("index rebuild temporary"). — [Apple Community 255862819](https://origin-discussions2-us-dr-prz.apple.com/thread/255862819); [Apple Community 255825544](https://discussions.apple.com/thread/255825544)
- Tahoe (macOS 26) reports: many threads say rebuilds don't help or that local file results are missing while apps are found. One TidBITS user fixed it by deleting the Spotlight DB, re-enabling, and restarting. Another says rebuilding "almost" works and has had unreliable search for years, needing a rebuild before trusting negative results. Tahoe also reset Spotlight settings on upgrade. — [TidBITS Talk: Spotlight in OS 26](https://talk.tidbits.com/t/spotlight-in-os-26-not-indexing-all-files/32065); [Apple Community 256149405](https://discussions.apple.com/thread/256149405); [Apple Community 256178172](https://discussions.apple.com/thread/256178172)
- Unverified third-party claim: on Tahoe, a Terminal tweak restoring the old Launchpad layout can stop Spotlight working. The suggested fix is `defaults delete com.apple.dock springboard-columns-int` and a restart. — [cloudhousetechnologies.com (vendor blog, low reliability)](https://cloudhousetechnologies.com/blog/macos-spotlight-search-not-working-fix-2026)
- Oakley (via mjtsai, July 2026): Spotlight doesn't appear able to search Time Machine backups reliably in Sequoia or Tahoe. Don't treat TM-volume failures as index corruption. — [mjtsai.com 2026-07-09](https://mjtsai.com/blog/?p=52570)
- Outlook and other apps using Core Spotlight keep their data app-private. It can't be debugged with mdfind or SpotTest, and isn't fixed by the volume index rebuild. — [Eclectic Light 2025-11-20 comments](https://eclecticlight.co/2025/11/20/diagnose-spotlight-local-search-problems/)

### Inferences (escalation ladder)
1. Capture evidence while broken: `sudo mddiagnose`, then crash reports for mds/mdworker, then `log show` by process.
2. If a poison file is named, move it out and test with `mdimport -t -d3 <file>`. If a third-party importer is implicated, remove its `.mdimporter` from `/Library/Spotlight`, `~/Library/Spotlight`, or its app, then `mdutil -r` or `-E`. Alternatively, exclude the folder with Search Privacy or a `.noindex` suffix.
3. Run Disk Utility First Aid on the Data volume, or `fsck_apfs` from Recovery, to rule out filesystem damage. Not fetched: [Apple: Repair a storage device](https://support.apple.com/guide/disk-utility/repair-a-storage-device-dskutl1040/mac).
4. Rebuild once properly: `sudo mdutil -E /System/Volumes/Data`, then reboot, and leave it until mds_stores goes idle. A manual delete of `.Spotlight-V100` (`mdutil -X`, or from Recovery) is a last resort. It's not needed per Oakley.
5. Isolate: boot into Safe Mode, which skips third-party login items and extensions, and test the canary. Also test in a new user account. If both are clean, the cause is third-party. Not fetched: [Apple: Safe mode](https://support.apple.com/guide/mac-help/start-up-your-mac-in-safe-mode-mh21245/mac).
6. Reinstall macOS over the current install from Recovery. This keeps data and refreshes system importers and daemons. Not fetched: [Apple: Reinstall macOS](https://support.apple.com/en-us/102655).
7. File a Feedback Assistant report with the mddiagnose archive attached. That archive is what Apple's tool is designed to produce.

### Gaps
- No primary source found on *why* indexes corrupt on a periodic schedule, such as a link to sleep, OS updates, or Time Machine. Correlation must come from the user's own canary log.
- No Apple statement on known Spotlight index bugs in macOS 26.x, or whether a 26.x point release fixed them.
- Safe Mode, First Aid and reinstall guidance pages were not fetched in this session.

## 4. Alternatives that do not depend on the Spotlight index

### Takeaway
EasyFind (DEVONtechnologies, free) and Find Any File (Tempelmann, paid) scan the disk directly and keep working when the index is broken. HoudahSpot and Finder search are front-ends to Spotlight and break with it.

### Cited Findings
- EasyFind is free and finds files and folders without relying on the system index. It also searches contents, and runs the search live as you type. — [AlternativeTo / SourceForge listings](https://sourceforge.net/app/easyfind/mac/); [AlternativeTo](https://alternativeto.net/software/easy-find/about)
- Find Any File "does not access a pre-built database but searches the chosen volume directly". It also finds items Spotlight skips, such as inside bundles and system folders. It sells for $8 on the Mac App Store and as shareware on the developer site. — [Find Any File](https://apps.tempel.org/FindAnyFile); [Mac App Store](https://apps.apple.com/app/id402569179); [Daring Fireball](https://daringfireball.net/linked/2024/08/08/find-any-file)
- HoudahSpot is sold by Houdah, a competitor, and its comparison page should be read with that in mind. HoudahSpot itself builds on Spotlight. — [Houdah comparison page](https://macfilesearch.com.houdah.com/easyfind-find-any-file.html)
- EasyFind was recommended on TidBITS as a fallback when Tahoe Spotlight failed. — [TidBITS Talk](https://talk.tidbits.com/t/spotlight-in-os-26-not-indexing-all-files/32065)

### Inferences
- Raycast and Alfred file search use Spotlight metadata queries by default (from training knowledge, not verified here), so they would fail along with the index. Command-line `find` / `grep -rl` and `fd`/`ripgrep` are index-independent.
- ProFind (Zevrix) offers both Spotlight and direct-scan modes (unverified).

### Gaps
- Not verified: Raycast's and Alfred's current file-search back ends, ProFind's current status, and macOS 26 compatibility of EasyFind and Find Any File.
