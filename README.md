# MaGarderie Scraper

Command line tool that automatically fetches daycares from <http://www.magarderie.com>
based on a set of input query parameters.  
Stores the results in a Mongo database. With each run will compare the findings from the current
run against the results stored in the database.  
Sends an e-mail containing new or updated results with each run.

## Requirements

1. Mongo DB
2. Gmail Account. Can be configured to use a different account, 
see [nodemailer](http://www.nodemailer.com/) 

## Installation

    npm install
    
## Configuration

Rename config.js.template to config.js.  
Edit values in config.js

* query parameters
* mail credentials and recipients
* db connection string

## Usage
    
    node index.js  
    
or
    
    npm run
