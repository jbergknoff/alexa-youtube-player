terraform {
  backend "s3" {
    region = "us-east-1"
    bucket = "jbergknoff-deploy"
    key = "alexa-youtube-player/terraform.tfstate"
  }
}

provider "aws" {
  version = "1.5"
  region = "us-east-1"
  access_key = "${var.aws_access_key}"
  secret_key = "${var.aws_secret}"
}

resource "aws_iam_role_policy" "iam_policy_for_lambda" {
  name = "log_access"
  role = "${aws_iam_role.lambda_role.id}"
  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
EOF
}

resource "aws_iam_role" "lambda_role" {
    name = "${var.project_name}_lambda_execution"
    assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
EOF
}

resource "aws_lambda_function" "alexa_handler" {
  function_name = "${var.project_name}"
  role = "${aws_iam_role.lambda_role.arn}"
  handler = "index.handler"
  runtime = "nodejs6.10"
  filename = "${var.zip_filename}"
  source_code_hash = "${base64sha256(file(var.zip_filename))}"
  timeout = 30

  environment {
    variables = {
      YOUTUBE_API_KEY = "${var.youtube_api_key}"
    }
  }
}

# cf. https://github.com/terraform-providers/terraform-provider-aws/blob/0dc757f03080416b9770d2c02ca843db27ef7bd9/examples/alexa/main.tf#L6-L12
resource "aws_lambda_permission" "with_alexa" {
  statement_id = "AllowExecutionFromAlexa"
  action = "lambda:InvokeFunction"
  function_name = "${aws_lambda_function.alexa_handler.function_name}"
  principal = "alexa-appkit.amazon.com"
}
