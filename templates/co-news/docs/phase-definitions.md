# Phase Definitions — co-news

| Phase | Name | Owning Agent(s) | Description |
|-------|------|-----------------|--------------|
| 0 | Assignment Scoping | pm | Establish story angle, target company/companies, target register (Sedaily-style general-economic tone vs TheBell-style IB/PE specialist tone), and target output language (per active country profile; KR default: Korean) |
| 1 | Data & Legal Research | financial-analyst, legal-researcher | Parallel: financial-analyst pulls k-dart data into a narrative brief; legal-researcher pulls k-law context if the story touches corporate law |
| 2 | Fact Verification | fact-checker | Build the citation ledger; require 2+ independent sources per material claim; block on any UNVERIFIED claim |
| 3 | Drafting | reporter | Write headline/lead/body strictly from the verified ledger and briefs |
| 4 | Style Pass | style-editor | AI-tell reduction + house-style conformance; re-verify figures against the ledger post-rewrite |
| 5 | Visualization | visual-editor | Generate inline SVG financial infographics from the narrative brief |
| 6 | Final QA / Publish Gate | pm | Confirm fact-checker (0 UNVERIFIED) and style-editor sign-off before marking publish-ready |
