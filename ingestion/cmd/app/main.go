package main

import (
	"encoding/csv"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/LDFLK/RTI-Tracker/ingestion/internals/client"
	"github.com/LDFLK/RTI-Tracker/ingestion/internals/core"
	"github.com/LDFLK/RTI-Tracker/ingestion/internals/models"
	"github.com/LDFLK/RTI-Tracker/ingestion/internals/ports"
	"github.com/LDFLK/RTI-Tracker/ingestion/internals/utils"
)

func main() {

	dataDir := flag.String("data", "", "Path to data directory containing csv files")

	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "Usage of %s:\n\n", os.Args[0])
	}

	flag.Parse()

	// access environment variables
	ingesUrl := os.Getenv("INGESTION_URL")
	if ingesUrl == "" {
		log.Fatal("Ingestion Service URL Required")
	}

	reUrl := os.Getenv("READ_URL")
	if reUrl == "" {
		log.Fatal("Read Service URL Required")
	}

	// Initialize services
	apiClient := client.ApiClient(ingesUrl, reUrl)
	ingestionService := ports.NewIngestionService(*apiClient)
	readService := ports.NewReadService(*apiClient)
	s := core.NewRTIService(ingestionService, readService)

	// validate flags
	if *dataDir == "" {
		fmt.Fprintf(os.Stderr, "Error: Data directory path is required\n\n")
	}

	err := filepath.WalkDir(*dataDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			fmt.Printf("Error: %s\n\n", err)
			return err
		}

		if d.IsDir() {
			fmt.Printf("Directory: %s\n", path)
		} else {
			fmt.Printf("File: %s\n", path)
			log.Println("Processing file...")

			fileName := filepath.Base(path)
			fileDir := filepath.Dir(path)
			splittedDir := strings.Split(fileDir, string(filepath.Separator))

			// access the date from the folder structure
			date := splittedDir[len(splittedDir)-2]
			dateISO, err := utils.DateToISO(date)

			if err != nil {
				log.Printf("failed to parse date %v", err)
				return nil
			}

			if fileName == "status.csv" {
				// attribute insertion process for status
			} else {
				// node creation process and attribute insertion for request
				// open the file
				f, err := os.Open(path)
				if err != nil {
					log.Printf("Failed to open file: %s , %v", path, err)
					return nil
				}

				defer f.Close()

				r := csv.NewReader(f)

				// read the first line of the csv first to skip the first line
				if _, err := r.Read(); err != nil {
					fmt.Printf("Error accessing fields in csv: %s", err)
				}

				// access data starting from the second row in the csv
				for {
					record, err := r.Read()

					if err == io.EOF {
						break
					}

					if err != nil {
						log.Println("Err reading records in the file")
					}

					title := record[0]
					content := record[1]
					sender := record[2]
					receiverInstitution := record[3]
					receiverPosition := record[4]

					// field data to the RTIRequest
					entity := &models.RTIRequest{
						Title:               title,
						Content:             content,
						Sender:              sender,
						ReceiverInstitution: receiverInstitution,
						ReceiverPosition:    receiverPosition,
						Created:             dateISO,
					}

					_, err = s.ProcessRTIEntity(entity)

					if err != nil {
						log.Printf("Entity creation failed %s", title)
					}

				}

			}

		}

		return nil
	})

	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("Successfully processed all arguments")

}
