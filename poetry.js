Verses = new Meteor.Collection("verses");
Counts = new Meteor.Collection("counts");
Subscriptions = new Meteor.Collection("subscriptions");

var LIMIT = 20;

if (Meteor.isClient) {
    ["verses", "counts"].forEach(function (col) { Meteor.subscribe(col); });

    Handlebars.registerHelper("pad", function(number) {
        return ("000"+number).slice(-3);
    });

    var counter = function () {
        return Counts.findOne();
    };

    Template.verse.counter = counter;
    Template.poetry.counter = counter;

    Template.poetry.verses = function () {
        var verses = Verses.find({}, {sort: {number: -1}, limit: LIMIT});
        var array = verses.fetch();
        return array.reverse();
    };

    Template.poetry.events({
        "submit #formverse": function () {
            // trivial bot detection
            var antispam = document.getElementById("antispam").value;
            if (antispam != "") {
                return false;
            }

            var verse = document.getElementById("verse").value;
            if (!validateVerse(verse)) {
                alert("No parece un verso válido. No seas troll.");
                return false;
            }

            if (confirm("Tu verso no se podrá borrar. ¿Estás seguro?")) {
                var number = Counts.findOne().count + 1; // XXX race conditions
                Verses.insert({number: number, value: verse, date: Date.now(), spam: 0})
                document.getElementById("verse").value = "";
                document.getElementById("verse").disabled = true;
                document.getElementById("submit").disabled = true;

                document.getElementById("footer").className = ""; // unhide
                document.getElementById("email").focus();
            };

            return false;
        },
        "submit #formsubscribe": function () {
            var email = document.getElementById("email").value;

            if (!validateEmail(email)) {
                return false;
            }

            Subscriptions.insert({email: email, date: Date.now()});
            alert('Te acabas de suscribir. Gracias.');

            return false;
        },
        "click .spam": function () {
            if (confirm("Vas a reportar un abuso. ¿Estás seguro de que es un verso inapropiado?")) {
                Verses.update(this._id, { $inc: { spam: 1 } });
                alert('Hecho. Gracias por colaborar');
            }
            return false;
        }
    });

    var FORBIDDEN_TOKENS = ["zx", "asd", "qwe", "http", "www", "<", ">", "{", "}", "script"];

    function validateVerse(verse) {
        if (verse.length < 4) {
            return false;
        }

        FORBIDDEN_TOKENS.forEach(function (token) {
            if (verse.indexOf(token) > -1) {
                return false;
            }
        });

        var THREECONSECUTIVE_PATTERN = /([a-z\d])\1\1/igm;
        if (verse.match(THREECONSECUTIVE_PATTERN)) {
            return false;
        }

        var FOURCONSONANTS_PATTERN = /[b-df-hj-np-tv-z]{4}/igm;
        if (verse.match(FOURCONSONANTS_PATTERN)) {
            return false;
        }

        if (!isNaN(verse)) {
            return false;
        }

        return true;
    };

    function validateEmail(email) {
        if (email.length < 4 || email.indexOf("@") === -1 || email.indexOf(".") === -1) {
            return false;
        }

        return true;
    };
}

if (Meteor.isServer) {
    // TODO server side validations http://docs.meteor.com/#deny

    Meteor.startup(function () {
        /**
        Verses.remove({});
        for (var i=0; i<30; i++) {
            Verses.insert({
                number: i,
                value: "Verso de cartón piedra para probar",
                date: Date.now());
        }*/
    });

    Meteor.publish("verses", function () {
        return Verses.find({}, {sort: {number: -1}, limit: LIMIT});
    });

    Meteor.publish("counts", function () {
        var self = this;
        var uuid = Meteor.uuid();
        var count = 0;
        var initializing = true;

        var handle = Verses.find({}).observeChanges({
            added: function (doc, idx) {
                count++;
                if (!initializing) {
                    self.changed("counts", uuid, {count: count});
                }
            },
            removed: function (doc, idx) {
                count--;
                if (!initializing) {
                    self.changed("counts", uuid, {count: count});
                }
            }
        });

        initializing = false;

        self.added("counts", uuid, {count: count});
        self.ready();

        self.onStop(function () {
            handle.stop();
        });
    });
}
