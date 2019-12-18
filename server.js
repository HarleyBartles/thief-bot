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

const mentions = T.stream('statuses/filter', { track: `${config.self_user_name}` });

mentions.on('tweet', (tweet) => mentionEvent(tweet));

const mentionEvent = async (tweet) => {
    const names = tweet.entities.user_mentions.map(u => u.screen_name).filter(n => n.toLowerCase() != config.self_user_name.toLowerCase())
    names.push(tweet.user.screen_name)

    if (!tweet.in_reply_to_status_id_str)
        return // don't do anything if the mention isn't a reply to some other tweet

    const original = await helpers.getThreadStarter(tweet)

    if (!original)
        return // something went wrong if we don't have a tweet here
    
    const duplicateTweets = await helpers.getIdenticalTweets(original)
    const duplicateCount = parseInt(duplicateTweets.length)

    if (isNaN(duplicateCount))
        return // something went wrong

    let reply = replyTo(names)

    if (duplicateCount > 0){
        reply += 'Thief'
        postReply(reply, tweet.id_str);
    } else {
        sendToSelf(tweet)
    }
};

const sendToSelf = (tweet) => {
    const messageData = {
        'event': {
            'type': 'message_create', 
            'message_create': {
                'target': {
                    'recipient_id': config.self_user_id
                },
                "message_data": {
                    "text": `twitter.com/user/status/${tweet.id_str}`
                }
            }
        }
    }

    T.post('https://api.twitter.com/1.1/direct_messages/events/new.json', messageData )
}

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
