## How to run the service

#### source env
```
    source .env
```

#### run the tests
```
    go test ./tests/
```

#### run the scripts
```
    go run ./cmd/app/main.go --data "../data/RTI" -v
```

-------- or --------

#### run the test run file
```
    source .env
    chmod +X test_run.sh
    ./test_run.sh
```