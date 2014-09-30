var yargs = require('yargs');

/**
 * Default socket location if none is given.
 * @type {String}
 */
var DEFAULT_SOCKET = '/tmp/dazeus.sock';

/**
 * Takes an options array as parsed by yargs, processes it for dazeus-nodejs
 * @param  {Object} argv
 * @return {Object}
 */
module.exports.optionsFromArgv = function (argv) {
    var options = {};
    if (typeof argv.path === 'string') {
        options.path = argv.path;
    } else if (typeof argv.host === 'string' && typeof argv.port === 'number') {
        options.host = argv.host;
        options.port = argv.port;
    } else if (typeof argv.socket === 'string') {
        if(argv.socket.substr(0, 5) == 'unix:') {
            options.path = argv.socket.substr(5);
        } else if(argv.socket.substr(0, 4) == 'tcp:') {
            var pos_colon = argv.socket.lastIndexOf(':');
            if(pos_colon == 3) {
                options.host = argv.socket.substr(4);
            } else {
                options.host = argv.socket.substr(4, pos_colon - 4);
                options.port = Number(argv.socket.substr(pos_colon + 1));
            }
        } else {
            throw new Error("Socket type not understood: " + argv.socket);
        }
    } else {
        options.path = DEFAULT_SOCKET;
    }

    options.highlightCharacter = argv['highlight-character'];

    options.debug = false;
    if (argv.debug) {
        options.debug = true;
    }
    return options;
};

/**
 * Creates command line options used by dazeus-nodejs.
 * @return {Argv} yargs's Argv object
 */
module.exports.yargs = function () {
    return yargs
        .usage("Usage: $0")
        .boolean("debug")
        .string("path")
        .string("host")
        .string("socket")
        .string("highlight-character")
        .boolean("help")
        .alias("path", "f")
        .alias("host", "h")
        .alias("port", "p")
        .alias("socket", "s")
        .alias("debug", "d")
        .alias("highlight-character", "c")
        .describe("path", "Path of a DaZeus unix socket, only required if no port and host are provided")
        .describe("host", "Host where a DaZeus instance accepts TCP connections")
        .describe("port", "Port corresponding to the given host")
        .describe("socket", "Socket to DaZeus in standard notation: unix:path / tcp:host:port")
        .describe("debug", "Let dazeus-nodejs display debug messages")
        .describe("highlight-character", "The highlight character to use")
        .describe("help", "Display this help message")
        .default("highlight-character", "}");
};

/**
 * Show the help message if the provided arguments require it
 * @param {Argv} argv yargs's Argv object
 */
module.exports.help = function (argv) {
    if (argv.help) {
        optimist.showHelp();
        process.exit();
    }
};

/**
 * Helper function for reading the contents of a file into an array
 * @param  {String} file Name of the file
 * @return {Array}       Data in the file
 */
module.exports.readFile = function (file) {
    var fs = require('fs');
    return fs.readFileSync(file).toString().split("\n").filter(function (element) {
        return element.trim().length > 0;
    });
};

/**
 * Helper function for writing the contents of an array to a file
 * @param  {String} file The file the data should be written to
 * @param  {Array}  data The data to be written away
 */
module.exports.writeFile = function (file, data) {
    var fs = require('fs');
    var stream = fs.createWriteStream(file, {flags: 'w'});
    for (var i in data) {
        if (data.hasOwnProperty(i)) {
            if (typeof data[i] === 'string') {
                stream.write(data[i] + "\n");
            }
        }
    }
    stream.end();
};

/**
 * Determine whether or not a string is in a file (on a separate line)
 * @param  {String} file The name of the file where the string is located
 * @param  {String} str  The string to check for
 * @return {Boolean}     True of the string is in the file, false if it isn't
 */
module.exports.existsIn = function (file, str) {
    if (typeof file === 'string') {
        file = module.exports.readFile(file);
    }
    for (var i in file) {
        if (file.hasOwnProperty(i)) {
            if (file[i].trim() === str.trim()) {
                return true;
            }
        }
    }
    return false;
};

/**
 * Retrieve a random line from a file
 * @param  {String} file Name of the file to retrieve contents from
 * @return {String}      A random line from the file
 */
module.exports.randomFrom = function (file) {
    var array = module.exports.readFile(file);
    return array[Math.floor(Math.random() * array.length)];
};

/**
 * Remove the line matching the given string from the file
 * @param  {String} file Name of the file where the item could be located
 * @param  {String} str  The string to remove
 * @return {Boolean}     True of the item was removed, false if it wasn't there.
 */
module.exports.removeFrom = function (file, str) {
    var array = module.exports.readFile(file);
    if (!module.exports.existsIn(array, str)) {
        return false;
    } else {
        array = array.filter(function (elem) {
            return elem.trim() !== str.trim();
        });
        module.exports.writeFile(file, array);
        return true;
    }
};

/**
 * Add a string to a file in a new line
 * @param  {String} file The name of the file where the string should be written to
 * @param  {String} str  The string to append
 * @return {Boolean}     True of the string was appended, false if it already existed
 */
module.exports.appendTo = function (file, str) {
    var array = module.exports.readFile(file);
    if (module.exports.existsIn(file, str)) {
        return false;
    } else {
        array.push(str);
        module.exports.writeFile(file, array);
        return true;
    }
};

/**
 * Given the argument string from a command, this returns the first word, and the remainder in an array
 * @param  {String} args The arguments where a split on the first command is required
 * @return {Array}       An array containing under index 0 the first argument, and under index 1 the rest of the string.
 */
module.exports.firstArgument = function (args) {
    var first = args.split(/\s+/, 1).toString();
    var rest = args.trim().substr(first.length).trim();
    return [first, rest];
};

/**
 * Escape a string for usage in a regular expression
 * @param  {String} str
 * @return {String}
 */
module.exports.escapeRegExp = function (str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
};

/**
 * Run through a list of commands and check if those are the first arguments provided in the argument string.
 * If a command matches, then the yesCallback is executed, otherwise, the (optional) noCallback is executed.
 * The command may also be a string, then only one check is executed. If a match is found and the yesCallback
 * is executed, the remainder of argumetns will be used for the first parameter, if no match is found the
 * noCallback is executed with the original args input string. You can also use '$' for wildcard positions. These
 * positions will be returned as arguments for the yesCallback before the remainder arguments.
 * Some examples:
 *
 *     // this would execute the yesCallback with the remaining argument 'this world'
 *     isCommand('build', 'build this world', function () { ... });
 *
 *     // this would not execute anything
 *     isCommand('build', 'destroy this world', function () { ... });
 *
 *     // this would execute the yesCallback with the remaining argument 'house'
 *     isCommand(['build', 'a'], 'build a house', function () { ... });
 *
 *     // this would execute the noCallback with the original arguments
 *     isCommand(['build', 'a'], 'build the world', function () { ... }, function () { ... });
 *
 * @param  {Array}     command     The commands to check for
 * @param  {String}    args        Arguments to check on
 * @param  {Function}  yesCallback Callback to execute for a successful match
 * @param  {Function}  noCallback  Callback to execute for an unsuccessful match
 */
module.exports.isCommand = function (command, args, yesCallback, noCallback) {
    if (typeof command === 'string') {
        command = [command];
    }
    var originalArgs = args;
    var accept = true;
    var additionalArgs = [];
    while (command.length > 0) {
        var next = command.shift();
        if (next.trim() === '$$' && (command[0] !== '$' && command[0] !== '$$')) {
            var afterThis = command[0];
            if (typeof afterThis === 'string') {
                afterThis = [afterThis];
            }
            var regex = "^(.*?)\\s+" + _(afterThis).map(function (item) {
                return module.exports.escapeRegExp(item);
            }).join('|');
            regex = new RegExp(regex);
            var matches = regex.match(args);

        } else {
            var argsplit = module.exports.firstArgument(args);
            if ((next === '$' || next === '$$') && argsplit[0].trim().length > 0) {
                additionalArgs.push(argsplit[0].trim());
                args = argsplit[1];
            } else {
                if (typeof next === 'string') {
                    next = [next];
                }

                if (_(next).contains(argsplit[0].trim())) {
                    args = argsplit[1];
                } else {
                    accept = false;
                    break;
                }
            }
        }
    }

    if (accept && typeof yesCallback === 'function') {
        additionalArgs.push(args);
        yesCallback.apply(this, additionalArgs);
    } else if (!accept && typeof noCallback === 'function') {
        noCallback.call(this, originalArgs);
    }
};
