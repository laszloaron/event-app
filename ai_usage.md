# Documenting the AI usage and the development workflow

I used Claude Code for my whole project.

## Defining the specification
After I had created the specification, I decided to use it as the main starting point. In my opinion, the agent has to understand the problem and the context very well to provide me the best possible output. So I decided to create a more detailed specification.
To do this, I used Claude to define 10 user stories.
Purpose: some real-life actions, which should be a great experience for a user, to help the agent plan the design of the app.
To give good context to the model, I first asked it to define for me what a good user story looks like and what its purpose is; after that I asked it to generate 10 for me based on the spec.

Then I read the user stories and a lot of questions came to my mind about how the app should work. So I decided to correct some of them and ask for more user stories.

Next I wanted to be sure that everything was well defined, but unfortunately I was wrong. I asked the agent to grill me and ask unclear questions related to the app's functionality. Then I had to think really deeply about what should happen in which case. I answered some questions which the agent gave me. And as a result, he generated more user stories for me...

Important note! There was an issue with the original spec that the agent called my attention to. Originally I forgot about multi-day events. If the event lasts more than two days, then it should be visible not only on the first day, so I corrected the first Acceptance Criterion: "all published events taking place today within the selected radius".
The 3rd main scenario was also a bit unclear; I replaced the "or", because in the original case the app should verify whether the ticket was bought or not. Since this is not easy to implement in this demo project, the user can click the "I'm going" button in the case of every event.
And in the 6th AC I will change one word. "Save" here means publish; it was a little misleading and unclear.

## Plan the project structure and architecture
I used the Claude Code plan mode to first make a high-level plan of how the architecture should look, and what the API endpoints and the data models should be. It created [architectures.md](architectures.md).
I provided some information about the main idea of the architecture.
> "I want to create a containerised application. There will be three containers: frontend (nginx with react), backend, database (postgres). The backend should use django, with the api layer django ninja, and with the map integration the geodjango"
and asked it not to write any code yet, because I did not want to one-shot the whole project, and wanted to make my own decisions and do a little engineering :)


## Creating AGENTS.md in the root
Next I asked the agent to create an AGENTS.md file, which is responsible for the general information about the project. So I do not have to prompt it every time to use the architecture and user stories. Now he can decide if he needs them, but of course if I want to use them, I will reference them in the prompt.
I decided to add some more general advice to the AGENTS.md file in the project root. There should be a log-gathering functionality which saves the logs of the containers into one file, so if something is wrong, the agent can follow it better and understand the problem. I also wanted to add information about how the agent should document. Add a command for running tests and starting the app. So these are general conventions for developing the app, like design patterns and general coding principles.


## Implementation

### Backend
I asked the agent to implement only a skeleton for the backend. I wanted only the structure of the app to be planned first, forcing the agent to think every piece of the software through better. If it goes through every functionality twice, maybe it can have a better solution for the implementation. I asked it to do it in plan mode first, to be more precise, before implementing the core of the project. It can cause a lot of headaches if something is broken in the base architecture.
First I asked the model to implement only the Docker, Django (settings), models, health check and logging. Plan and then execute.

After that I asked it to implement the service logic. I also used plan mode before. Here I asked it not to implement the logic. The functions should raise a NotImplementedError.
In some cases I made a comment in the execution plan, because I didn't understand every decision the agent made.

Writing tests based on the project skeleton, to ensure that the implementation of the logic is not seen.
While checking the code I noticed something: Django was not used as expected. The reason is that I didn't specify this part in detail (what the model should use), and the agent picked a solution which I was not a big fan of, so I asked him to change it. He even said that using the Ninja ModelSchema object for defining the model is a better choice than using Django's built-in model.

During the implementation I realised that it could be better if the API model and architecture definitions were in a separate format and a little bit more precise.

The next and last step of the business logic implementation: I asked the agent to generate some tests for it based on the user stories. Goal: every functionality of the application should work, every API endpoint should work; after this step only the frontend will be generated and the backend folder may remain untouched. In this step no new functions should be created. The agent asked me if he could create some private helper functions to reduce duplicated code.

I added to frontend/agents.md and backend/agents.md: "Reading and writing the test folder is prohibited while the agent is working on the code." This is not a guarantee; it can be overlooked very easily by the agent.


### Frontend
I will plan and generate the frontend with two separate agents. The workflow (prompts) will be the same. Claude Code and Antigravity will be compared.
My execution plan is the following:
1. I would plan the look first. For example: event card - not a full-screen window, there is a medium-sized button at the bottom, at the top there is the event title... and so on. Create the routing.
2. Then implement the components without logic, focusing on the look.
3. Implement the logic behind them based on the user_stories and spec.

#### Claude Code
Claude did not recognise every component from the user stories and the spec, so for example the login and register pages were not defined. I collected the main components, said explicitly what they are, and had to correct the plan.
After the second step, Claude decided to implement and use Playwright tests, but I did not give this instruction to him. I wanted to do it separately, after the app was ready. I asked why he did it and he answered. This solution is on the *backend-interface-stubs* branch.

#### Antigravity
It will be on the branch *ag-frontend*.

## Summary
In my opinion, agentic code generation is very good, especially for non-complex apps with a few technologies, but as the used stack grows, the agent can sometimes lose the scope and provide a solution that is not the most optimal. You still have to make the main decisions and understand the tools and architectures to be able to make a detailed spec and choose from the technologies. If you let the agent decide them, I think the solution would not be optimal, but still usable.
I tried to focus on the spec and make my idea as clear as possible (in some cases I didn't even know what the functionality should be, and had to think about it deeply). In these cases, if you did not specify them, the agent will pick one randomly, and in most cases these tiny things are what separate a good, usable software from a software which is doing well, but where not necessarily the intended things are happening. (Then the user prompts the agent: "I want this the other way", but then it may change something else too, and burn a lot of tokens.) Next time I would spend more time on defining the technologies and the architecture. I think there were some missing points on my side, and I had to correct them on the fly (prompt the agent to make a change; sometimes he asks, but definitely not 100 times if there are a lot of gaps in the spec).
