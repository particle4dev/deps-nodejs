module.exports = function(grunt){
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        // Configure a mochaTest task
        mochaTest: {
            test: {
                options: {
                    reporter: 'spec',
                    ui: 'tdd'
                },
                src: ['test/**/*.js']
            }
        },

        watch: {
            test: {
                files: 'test/**/*.js',
                tasks: 'mochaTest'
            },
            src: {
                files: 'src/**/*.js',
                tasks: 'mochaTest'
            }
        },

        jshint: {
            all: ['src/**/*.js', 'test/**/*.js']
        },

        browserify: {
            js: {
                // A single entry point for our app
                src: 'src/molly.js',
                // Compile to a single file to add a script tag for in your HTML
                dest: 'dist/app.js'
            }
        }
    });

    // Add the grunt-mocha-test tasks.
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    //grunt.loadNpmTasks('grunt-browserify');

    grunt.registerTask('default', 'mochaTest');

}