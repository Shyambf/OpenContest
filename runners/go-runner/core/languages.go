package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
)

type LanguageConfig struct {
	Name            string     `json:"name"`
	SourceFile      string     `json:"source_file"`
	CompileCommands [][]string `json:"compile_commands"`
	RunCommand      []string   `json:"run_command"`
}

var Languages = map[string]LanguageConfig{}

func loadLanguages() {
	langDir := getenv("LANGUAGES_DIR", "./languages")
	files, err := os.ReadDir(langDir)
	if err != nil {
		log.Printf("Warning: could not read languages directory %s: %v", langDir, err)
		return
	}

	for _, file := range files {
		if filepath.Ext(file.Name()) == ".json" {
			path := filepath.Join(langDir, file.Name())
			data, err := os.ReadFile(path)
			if err != nil {
				log.Printf("Error reading %s: %v", path, err)
				continue
			}

			var config LanguageConfig
			if err := json.Unmarshal(data, &config); err != nil {
				log.Printf("Error parsing %s: %v", path, err)
				continue
			}

			Languages[config.Name] = config
			log.Printf("Loaded language: %s", config.Name)
		}
	}
	
	if len(Languages) == 0 {
		fmt.Println("CRITICAL: No languages loaded! Runner will not be able to process jobs.")
	}
}
