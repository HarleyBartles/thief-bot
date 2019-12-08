'use strict';
const http = require('http');
const port = process.env.PORT || 1337;
const Twit = require('twit');
const config = require('./config.js');
const helpers = require('./helpers.js');

const T = new Twit(config);

const replyTo = (names) => names.map(name => `@${name} `).join("")

const server = http.createServer(function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end("Listening");
});

server.listen(port);

const mentions = T.stream('statuses/filter', { track: 'ThiefDecider' });

mentions.on('tweet', (tweet) => mentionEvent(tweet));

const mentionEvent = async (tweet) => {
    if (!tweet.in_reply_to_status_id_str)
        return

    const original = await helpers.getThreadStarter(tweet)

    if (!original)
        return
    
    const duplicateTweets = await helpers.getIdenticalTweets(original)
    const duplicateCount = parseInt(duplicateTweets.length)

    if (isNaN(duplicateCount))
        return

    const names = tweet.entities.user_mentions.map(u => u.screen_name).filter(n => n.toLowerCase() != 'thiefdecider')
    names.push(tweet.user.screen_name)

    let reply = replyTo(names)

    reply += duplicateCount === 0
        ? 'Not thief'
        : duplicateCount > 0
            ? 'Thief'
            : 'bot error. oh noes!'

    postReply(reply, tweet.id_str);
};

const postReply = (reply, replyTo) => {
    T.post('statuses/update', { status: reply, in_reply_to_status_id: replyTo }, tweeted);
};

const tweeted = (err, reply) => {
    if (err !== undefined) {
        console.log(err);
    } else {
         console.log('Tweeted: ' + reply);
    }
};
