import React from 'react';
import './style.css';
import { JobLog, JobLogLine } from '../../redux/store';
import { Table, Tooltip } from 'antd';

export interface JobLogProps {
    log: JobLog;
}

interface JobLogState {}

export default class JobLogs extends React.Component<JobLogProps, JobLogState> {
    renderJobLogLines() {
        return (
            <Table
                dataSource={this.props.log.lines}
                size="small"
                // scroll={{ y: 400 }}
                rowKey={(logLine: JobLogLine) => {
                    return String(logLine.lineNumber);
                }}
                pagination={{ position: 'top', showSizeChanger: true }}
                rowClassName={(line: JobLogLine) => {
                    if (line.isError) {
                        return 'JobLog-errorRow';
                    } else {
                        return 'JobLog-normalRow';
                    }
                }}
            >
                <Table.Column
                    title="Row"
                    dataIndex="lineNumber"
                    key="lineNumber"
                    width="8%"
                    render={(lineNumber: number, logLine: JobLogLine) => {
                        const numberDisplay = new Intl.NumberFormat('en-US', { useGrouping: true }).format(lineNumber);
                        if (logLine.isError) {
                            return <span className="JobLog-errorText">{numberDisplay}</span>;
                        }
                        return numberDisplay;
                    }}
                    sorter={(a: JobLogLine, b: JobLogLine) => {
                        return a.lineNumber - b.lineNumber;
                    }}
                />
                <Table.Column
                    title="Log line"
                    dataIndex="line"
                    key="line"
                    width="92%"
                    render={(line: string, logLine: JobLogLine) => {
                        let row;
                        if (logLine.isError) {
                            row = <span className="JobLog-errorText">{line}</span>;
                        } else {
                            row = <span>{line}</span>;
                        }
                        return <Tooltip title={line}>{row}</Tooltip>;
                    }}
                />
            </Table>
        );
    }
    render() {
        return <div className="JobLog">{this.renderJobLogLines()}</div>;
    }
}