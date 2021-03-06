const lookups = require('./lookups')
const moment = require('moment');
const _ = require('lodash');
const Twit = require('twit');
const config = require('./config.js');

const T = new Twit(config);

const getThreadStarter = async (tweet) => {
    const parent = await getParentTweet(tweet)
    
    if (parent.user.screen_name.toLowerCase() == config.self_user_name.toLowerCase())
        return null

    return parent.in_reply_to_status_id_str
        ? await getThreadStarter(parent)
        : parent
}

const getParentTweet = (tweet) => {
    return T.get('statuses/show', { id: tweet.in_reply_to_status_id_str })
        .then(res => {
            return res.data
        })
        .catch(err => {
            console.log(err)
            return err
        })
}

const sanitizeText = (tweet) => {
    let text = tweet.text

    if (tweet.truncated)
        text = text.replace(tweet.entities.urls[0].url, "").replace("… ", "")
    
    const textParts = _.words(text)

    text = textParts.filter(w =>{
        if (
            w.match(/(.)\1{2,}/) // any words which have more than 2 repeated letters
            || w.length < 2 // 1 letter words
            || lookups.badWords.includes(w.toLowerCase()) // list of words that commonly mess up the result
            ){
            return false
        }        
        return true
    }).join(" ")

    return text
}

const getSevenDayTweets = (tweet) => {
    const searchText = sanitizeText(tweet)

    const searchParams = {q: `-"RT "${searchText}`, maxId: tweet.id,  count: 100 }

    return T.get('https://api.twitter.com/1.1/search/tweets.json', searchParams)
        .then(res => {
            let originals = res.data.results.filter(s => !s.retweeted_status)
            const retweets = res.data.results.filter(s => !!s.retweeted_status)
            
            retweets.forEach( rt => {
                const originalIds = originals.map(o => o.id_str)
                if (originalIds.includes(rt.retweeted_status.id_str)){
                    originals.push(rt.retweeted_status)
                }
            })

            return originals.filter(t => t.id_str !== tweet.id_str)
        })
        .catch(err => {
            console.log(err)
            return err
        })
}

const getThirtyDayTweets = (tweet) => {
    const toDate = moment(tweet.created_at).format('YYYYMMDDHHmm')
    const searchText = sanitizeText(tweet)

    const searchParams = {query: `${searchText}`, toDate,  maxResults: 100 }

    return T.get('https://api.twitter.com/1.1/tweets/search/30day/development.json', searchParams)
        .then(res => {
            let originals = res.data.results.filter(s => !s.retweeted_status)
            const retweets = res.data.results.filter(s => !!s.retweeted_status)
            
            retweets.forEach( rt => {
                const originalIds = originals.map(o => o.id_str)
                if (originalIds.includes(rt.retweeted_status.id_str)){
                    originals.push(rt.retweeted_status)
                }
            })

            return originals.filter(t => t.id_str !== tweet.id_str)
        })
        .catch(err => {
            console.log(err)
            return err
        })
}

const getFullSearchTweets = (tweet) => {
    const fromDate = moment(tweet.created_at).subtract(5, 'years').format('YYYYMMDDHHmm')
    const toDate = moment(tweet.created_at).format('YYYYMMDDHHmm')
    const searchText = sanitizeText(tweet)

    const searchParams = {query: `${searchText}`, fromDate, toDate,  maxResults: 100 }

    return T.get('https://api.twitter.com/1.1/tweets/search/fullarchive/development.json', searchParams)
        .then(res => {
            let originals = res.data.results.filter(s => !s.retweeted_status)

            return originals.filter(t => t.id_str !== tweet.id_str)
        })
        .catch(err => {
            console.log(err)
            return err
        })
}

const getIdenticalTweets = (tweet) => {
    const sevenDayResults = getSevenDayTweets(tweet)

    if (sevenDayResults.some())
        return sevenDayResults

    const thirtyDayResults = getThirtyDayTweets(tweet)

    if (thirtyDayResults.some())
        return thirtyDayResults

    return getFullSearchTweets(tweet)
};

module.exports = {
    getThreadStarter,
    getParentTweet,
    getIdenticalTweets,
    sanitizeText
}