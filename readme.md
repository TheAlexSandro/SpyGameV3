# Spy Game

This is the source code of spy game on Telegram => <a href='https://SpyingGameBot.t.me'>@SpyingGameBot</a>

## Deployment

If you want to deploy this code to your own server and using your own bot, you can follow these steps:

### Configuration
Clone this repository by opening terminal and type:
<pre>git clone https://github.com/TheAlexSandro/SpyGameV3.git</pre>

Go to the code directory:
<pre>cd SpyGameV3</pre>

Copy .env.example to .env
<pre>cp .env.example .env</pre>

Fill all the blank variable in the .env file to your own.

## Run the bot
By using NodeJS:

- for testing purpose:
<pre>npm run dev</pre>

- for production:
<pre>npm run build</pre>
and then
<pre>npm run start</pre>

By using Docker Container:

You need to make the container image first by running this command:
<pre>docker build -t spygame</pre>
Run the container with .env file:
<pre>docker run -d -p 3000:3000 --name spygame_app --env-file .env spygame</pre>

And it's done!
