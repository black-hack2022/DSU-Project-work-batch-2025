import time
from first1 import load_df
from col import apply_columns
import networkx as nx


def build_service_protocol_graph(df):
    G = nx.Graph()
    # Iterate rows and connect service <-> protocol
    for s, p in zip(df['service'], df['protocol_type']):
        G.add_node(s, role='service')
        G.add_node(p, role='protocol')
        G.add_edge(s, p)
    return G


if __name__ == '__main__':
    start = time.time()
    df = load_df('KDDTrain+.txt')
    df = apply_columns(df)
    G = build_service_protocol_graph(df)
    end = time.time()
    print(f"Built graph in {end-start:.2f}s")
    print("Nodes:", G.number_of_nodes(), "Edges:", G.number_of_edges())
    # Show a few service nodes and their degree (optional)
    print('\nSample service degrees:')
    service_nodes = [n for n, d in G.nodes(data=True) if d.get('role') == 'service']
    for n in service_nodes[:10]:
        print(n, 'degree', G.degree(n))
