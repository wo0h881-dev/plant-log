<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Plant Log UI Rules
- All search inputs must keep stable dimensions on focus and use at least 16px text to prevent iOS focus zoom. Do not disable pinch zoom.
- Hide category `사망` in plant selection/search by default. Only the My Plants search may opt in to showing these plants. Preserve their records and historical views.

## Notion Authorization
- The user authorizes non-deletion operations needed for this plant app (reading, creating, editing, and linking records and its database properties) without repeated confirmation.
- Deleting, archiving, or trashing existing Notion records/databases still requires explicit confirmation. This does not override tool or system permission requirements.
