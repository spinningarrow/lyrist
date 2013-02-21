var request = require('request')
var cheerio = require('cheerio')

process.stdin.resume();
process.stdin.setEncoding('utf8');

// Get data from stdin (pipe artist name and song title from
// AppleScript)
process.stdin.on('data', function(data) {

	// Remove newline from data, if any
	data = data.replace(/\n/, '');

	// Check that iTunes is running, that a song is playing and that
	// an artist name and song title were passed in
	if (data == 'NOT_RUNNING') {
		process.stdout.write('iTunes is not running.')
		return
	}

	if (data == 'STOPPED') {
		process.stdout.write('There is no song playing in iTunes.')
		return
	}

	// Parse artist and song title
	var trackInfo = data.split(/@(?:artist|song)=/)
	trackInfo.shift()

	if (trackInfo.length !== 2) {
		process.stdout.write('That does not look like a valid artist and song title.\n')
		return
	}

	// All is good if we got this far; query using LyricWiki's API
	var queryUrl = 'http://lyrics.wikia.com/api.php?artist=' + encodeURIComponent(trackInfo[0]) + '&song=' + encodeURIComponent(trackInfo[1]) + '&fmt=xml'

	request.get(queryUrl, function (error, response, body) {

		var matches

		// Get artist and song information
		matches = body.match(/<artist>(.+)<\/artist>/)
		var artist = matches && matches[1]

		matches = body.match(/<song>(.+)<\/song>/)
		var song = matches && matches[1]

		// Check if lyrics were found
		if (body.indexOf('<lyrics>Not found') !== -1) {
			process.stdout.write('No lyrics could be found for ' + song + ' by ' + artist + '.\n')
			return
		}

		// Check if song is an istrumental piece
		if (body.indexOf('<lyrics>Instrumental') !== -1) {
			process.stdout.write(song + ' by ' + artist + ' is an instrumental.\n')
			return
		}

		// Get actual URL to lyrics
		matches = body.match(/<url>(.+)<\/url>/)
		var lyricsUrl = matches && matches[1]

		if (!lyricsUrl) {
			process.stdout.write('Invalid lyrics URL.\n')
			return
		}

		// Fetch the lyrics page and get the actual lyrics from it
		request.get(lyricsUrl, function (error, response, body) {

			var $ = cheerio.load(body)

			// Remove extra non-lyrics text
			$('.lyricbox').find('div').remove()
			var html = $('.lyricbox').html()
			html = html.substring(0, html.indexOf('<!--'))

			var $div = $('<div></div>')
			$div.text(html.replace(/<br>/gi, '\n'))

			process.stdout.write('\033[94m' + song + '\033[0m by \033[94m' + artist + '\033[0m\n\n')
			process.stdout.write($div.text())
		})
	})
});