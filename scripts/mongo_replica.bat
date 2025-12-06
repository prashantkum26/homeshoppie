@echo off
SET REPLSET=rs0
SET MONGO_CONF="C:\Program Files\MongoDB\Server\6.0\bin\mongod.cfg"

echo ==============================================
echo  Stopping MongoDB Service
echo ==============================================
net stop MongoDB

echo ==============================================
echo  Updating mongod.cfg to enable replica set
echo ==============================================

REM Remove existing replication block (basic safe version)
powershell -Command "(Get-Content %MONGO_CONF% | Where-Object {$_ -notmatch 'replSetName'} ) | Set-Content %MONGO_CONF%"

REM Append replica set block
echo replication:>> %MONGO_CONF%
echo ^  replSetName: "%REPLSET%">> %MONGO_CONF%

echo ==============================================
echo  Starting MongoDB Service
echo ==============================================
net start MongoDB

echo Waiting 5 seconds for MongoDB to initialize...
timeout /t 5 /nobreak >nul

echo ==============================================
echo  Initializing the Replica Set
echo ==============================================
"C:\Program Files\MongoDB\Server\6.0\bin\mongo.exe" --eval "rs.initiate()"

echo ==============================================
echo Replica Set Setup Completed!
echo ==============================================
pause
