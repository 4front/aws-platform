# Make a curl request to url http://169.254.169.254/latest/meta-data/instance-id
# to get the instance-id and store it in an environment variable

# Invoke the describe-tags CLI command to get the list of tags which includes
# elasticbeanstalk:environment-name

# Invoke the describe-configuration-settings CLI to get the environment configuration settings
# aws elasticbeanstalk describe-configuration-settings --application-name 4front-platform --environment-name nonprod-internal

# Run the node setup script? Or just do it all in Python?

# Get the node version from the NodeVersion option in the config settings
# "OptionName": "NodeVersion",
#     "Namespace": "aws:elasticbeanstalk:container:nodejs",
#     "Value": "0.12.6"
# Build the full path to npm by appending to /opt/elasticbeanstalk/node-install/node-v0.12.6-linux-x64/bin/npm

# Read the environment variables
# aws elasticbeanstalk describe-configuration-settings --application-name 4front-platform --environment-name nonprod-internal


# How do we get the name of the S3 bucket?
# How do we get the name of the ElasticBeanstalk environment?
# It's stored in the tag: elasticbeanstalk:environment-name
