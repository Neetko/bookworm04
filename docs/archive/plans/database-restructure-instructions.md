We come to a very crucial point in development. We need standardized data which we will reference across the app. therefore this needs to be done precisely. Our DB and data flows needs to make sense and be structurally sound. 

We need a singular table ie 'book_titles' - which would serve as the source of truth and be populated by data drawn from GoogleBooks API, modified to fit our structure and prevent duplication (any genre data needs to be mapped to our 7 canon genres and boks that share title and author should be deduped into 1 before the data is spat out as a search result). 

Adittional Deduplication Strategy: * Iterate through the results. If multiple books share the same "Grouping Key," merge them.

Use industryIdentifiers (ISBN_13 or OCLC) as a secondary check—if these match, they are the same book.

Deduping and genre sorting happens when the user fires off a search and response data is returned from GoogleBooksAPI, before search results appear for the user

Actual ingestion of the data into our 'book_titles' table happens upon a user tracking that 'book'. When that happens the metadata is ingested, a dynamic page is created for that book which can be visited to leave reviews and discuss, and that user's profile tracks/references that created row in the table (ie in 'read titles')

'Library' table (currently for our purposes that table is just called 'books' and that creates confusion) would use the id column of the 'book_titles' table as a foreign key and hold the content which would be displalyed in the reader of our curated eBook library. It doesn't need hold much other data about the titles themselves, since that reference can also be darawn from 'book_titles' 