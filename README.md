# Work Scheduler (When Do I Guard)
At the moment, specifically made for scheduling lifeguards at the pool I work at. We used to use Google Sheets, which takes forever to schedule guards (adding up their hours, adding up haw many guards are working each day, etc.). Plus, we have to ask for days off using a paper - pretty inconvenient.

# About
Managers can easily create schdeules, adding shifts to a spreadsheet-style view by clicking cells. Workers can view published schedules and request off.

# Features
- Calculates total weekly hours for each worker automatically
- Calculates how may guards/front workers are working that day (morning/evening)
- Editable shift time presets based on selected role
- Select multiple workers at a time to complete an action for them all at once
- Undo/Redo buttons for changes made to shifts
- Workers log in with their email, the company code, and a password and are automatically synced to the worker profile with that email
- Publish schedule to display it to workers
- Easy-add toolbar; click on shift preset then click on any cell to fill it with that preset
- Print schedule; prints in a simplified table format
- Workers can request OFF; auto-approved if made 2+ weeks in advance, otherwise manager must approve
- Manage OFF requests page: manager can deny/approve requests, workers can view/retract their requests
- Manager can set "OFF Rules", giving a worker OFF in a repeating manner (ex. every Friday 4-8pm)
- and much more...

# Tech
- React, Vite
- Firebase
- Lucide Icons
